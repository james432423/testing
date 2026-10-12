/**
 * One model client for both roles, speaking the OpenAI/OpenRouter
 * chat-completions protocol. In MODEL_MODE=mock it never touches the network.
 */
import { loadModelConfig, type ModelConfig } from '../env.ts';

export type ChatMessage = { role: 'system' | 'user'; content: string };

/**
 * JSON for the inside of a <tag>...</tag> fence in a prompt. "<", ">" and "&"
 * are written as \u escapes, so untrusted text (an email, a PDF, a worker
 * draft) can never contain a literal "</action>" or "<rules>" that closes the
 * fence and makes the rest read like instructions. JSON.parse restores them.
 */
export function fencedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
export type ModelRole = 'worker' | 'reviewer';

export interface ModelClient {
  readonly role: ModelRole;
  readonly model: string;
  complete(messages: ChatMessage[]): Promise<string>;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const MAX_RESPONSE_CHARS = 1_000_000;

export type ClientOptions = {
  config?: ModelConfig;
  fetch?: FetchLike;
  /** Override the mock responder (tests). */
  mock?: (messages: ChatMessage[]) => string | Promise<string>;
  timeoutMs?: number;
};

export function createModelClient(role: ModelRole, opts: ClientOptions = {}): ModelClient {
  const config = opts.config ?? loadModelConfig();
  const target = role === 'worker' ? config.worker : config.reviewer;

  if (config.mode === 'mock' || opts.mock) {
    const respond = opts.mock ?? (role === 'worker' ? mockWorker : mockReviewer);
    return { role, model: target.model, complete: async (m) => respond(m) };
  }

  const doFetch: FetchLike = opts.fetch ?? ((u, i) => fetch(u, i));
  return {
    role,
    model: target.model,
    async complete(messages) {
      const res = await doFetch(`${target.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${target.apiKey ?? ''}`,
          'x-title': 'Ida',
        },
        body: JSON.stringify({
          model: target.model,
          messages,
          temperature: 0,
          // Bounds the cost of one call (a worker draft is at most ~20k chars).
          max_tokens: role === 'worker' ? 8000 : 2000,
          response_format: { type: 'json_object' },
        }),
        // Never follow a redirect: it could carry the API key to another host.
        redirect: 'error',
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
      if (!res.ok) throw new Error(`model call failed with HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_RESPONSE_CHARS) throw new Error('model response too large');
      const json = JSON.parse(text) as { choices?: { message?: { content?: unknown } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('model returned no content');
      return content;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mock responders                                                     */
/* ------------------------------------------------------------------ */

/** Pulls the JSON block between the given markers out of the last user message. */
export function extractBlock(messages: ChatMessage[], tag: string): unknown {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const start = last.indexOf(`<${tag}>`);
  const end = last.indexOf(`</${tag}>`);
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(last.slice(start + tag.length + 2, end));
  } catch {
    return null;
  }
}

type MockWorkerContext = {
  workflow: { name: string };
  deal: { id: string; name: string };
  contacts: { name: string; email: string; role: string }[];
  sources: { id: string; title: string; pages: { page: number; text: string }[] }[];
  ownerName: string;
};

/** Deterministic worker: writes a short update to the first contact, citing the first source sentence. */
function mockWorker(messages: ChatMessage[]): string {
  const ctx = extractBlock(messages, 'context') as MockWorkerContext | null;
  if (!ctx || !ctx.contacts?.length) return JSON.stringify({ error: 'no context' });
  const to = ctx.contacts[0]!;
  const src = ctx.sources.find((s) => s.pages.length > 0);
  const page = src?.pages[0];
  const sentence = page ? (page.text.match(/[^.]+\./)?.[0] ?? page.text).trim() : '';
  const first = to.name.split(' ')[0];
  const body = src
    ? `Hi ${first},\n\nA quick update on ${ctx.deal.name}. From the ${src.title.toLowerCase()}: ${sentence}\n\n${ctx.ownerName}`
    : `Hi ${first},\n\nA quick check-in on ${ctx.deal.name}. Let me know if you have questions.\n\n${ctx.ownerName}`;
  return JSON.stringify({
    action: {
      type: 'send_email',
      to: [{ name: to.name, email: to.email }],
      cc: [],
      subject: `Update on ${ctx.deal.name}`,
      body,
      citations: src && page ? [{ sourceId: src.id, page: page.page, quote: sentence, claim: sentence }] : [],
    },
    notes: 'mock worker: summarized the first source sentence',
  });
}

/** Deterministic reviewer: approves unless the action text asks for a rejection or garbage (demo hooks). */
function mockReviewer(messages: ChatMessage[]): string {
  const action = extractBlock(messages, 'action') as { body?: string; subject?: string } | null;
  const text = `${action?.subject ?? ''} ${action?.body ?? ''}`;
  if (text.includes('[[mock:garbage]]')) return 'sure, looks fine to me';
  if (text.includes('[[mock:reject]]')) return JSON.stringify({ verdict: 'reject', reasons: ['Mock reviewer was asked to reject this.'] });
  return JSON.stringify({ verdict: 'approve', reasons: ['Claims match the cited excerpts and no rule is triggered.'] });
}
