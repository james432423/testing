/**
 * The structured shape of a proposed action, and its content hash.
 * The worker's output must match ActionContent exactly (strict: unknown keys
 * such as "approved" or "status" are rejected, not ignored).
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Single-line fields (subject, recipient names) end up in email headers once a
 * real mail integration exists, so control characters - CR/LF above all - are
 * rejected to rule out header injection. The body may contain newlines and
 * tabs but no other control characters.
 */
const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;
const BODY_CONTROL_CHARS = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
const singleLine = (max: number) => z.string().trim().min(1).max(max).regex(NO_CONTROL_CHARS, 'must be a single line without control characters');

export const Recipient = z
  .object({
    name: singleLine(200),
    email: z.string().trim().toLowerCase().email().max(320),
  })
  .strict();

export const Citation = z
  .object({
    sourceId: z.string().uuid(),
    page: z.number().int().min(1).max(10_000),
    /** Exact words from the source page. */
    quote: z.string().trim().min(3).max(1000),
    /** The words in the draft that this citation supports. */
    claim: z.string().trim().min(3).max(1000),
  })
  .strict();

export const ActionContent = z
  .object({
    type: z.enum(['send_email', 'send_invite']),
    to: z.array(Recipient).min(1).max(20),
    cc: z.array(Recipient).max(20).default([]),
    subject: singleLine(300),
    body: z.string().trim().min(1).max(20_000).regex(BODY_CONTROL_CHARS, 'must not contain control characters'),
    citations: z.array(Citation).max(50).default([]),
  })
  .strict();
export type ActionContent = z.infer<typeof ActionContent>;

/** What the worker hands to the gate. */
export const WorkerProposal = z
  .object({
    action: ActionContent,
    notes: z.string().max(4000).optional(),
  })
  .strict();
export type WorkerProposal = z.infer<typeof WorkerProposal>;

export type ActionEnvelope = {
  workspaceId: string;
  workflowId: string;
  dealId: string;
  content: ActionContent;
};

/** Deterministic JSON: object keys sorted at every level. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export function contentHash(env: ActionEnvelope): string {
  const payload = canonicalJson({
    v: 1,
    workspaceId: env.workspaceId,
    workflowId: env.workflowId,
    dealId: env.dealId,
    content: env.content,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function allRecipients(c: ActionContent): { name: string; email: string }[] {
  return [...c.to, ...c.cc];
}
