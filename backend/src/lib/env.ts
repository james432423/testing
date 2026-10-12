/**
 * Server-only configuration. Nothing here is ever imported by client
 * components, and none of these variables use the NEXT_PUBLIC_ prefix, so
 * Next.js never inlines them into a client bundle.
 */
import { z } from 'zod';

export class ConfigError extends Error {}

/** Provider is the part before the first "/" in an OpenRouter-style model id. */
export function providerOf(model: string): string {
  const i = model.indexOf('/');
  return (i > 0 ? model.slice(0, i) : model).toLowerCase();
}

const modelEnv = z.object({
  MODEL_MODE: z.enum(['mock', 'live']).default('mock'),
  MODEL_API_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  MODEL_API_KEY: z.string().optional(),
  REVIEWER_API_BASE_URL: z.string().url().optional(),
  REVIEWER_API_KEY: z.string().optional(),
  WORKER_MODEL: z.string().min(3).default('mock-worker/drafter'),
  REVIEWER_MODEL: z.string().min(3).default('mock-reviewer/checker'),
});

export type ModelConfig = {
  mode: 'mock' | 'live';
  worker: { baseUrl: string; apiKey?: string; model: string };
  reviewer: { baseUrl: string; apiKey?: string; model: string };
};

/**
 * Loads model settings and enforces the separation rule: the reviewer must be
 * a different model from a different provider than the worker. Called at
 * startup (src/instrumentation.ts) and again on every use, so a bad config
 * fails closed instead of quietly letting a model review its own work.
 */
export function loadModelConfig(env: Record<string, string | undefined> = process.env): ModelConfig {
  // Treat empty strings (e.g. "REVIEWER_API_KEY=" in .env) as unset.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = modelEnv.safeParse(cleaned);
  if (!parsed.success) throw new ConfigError(`Invalid model configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  const e = parsed.data;
  const w = e.WORKER_MODEL.trim();
  const r = e.REVIEWER_MODEL.trim();
  if (w.toLowerCase() === r.toLowerCase()) {
    throw new ConfigError('WORKER_MODEL and REVIEWER_MODEL must be different models.');
  }
  if (providerOf(w) === providerOf(r)) {
    throw new ConfigError('WORKER_MODEL and REVIEWER_MODEL must come from different providers (e.g. "openai/..." vs "anthropic/...").');
  }
  if (e.MODEL_MODE === 'live') {
    if (!e.MODEL_API_KEY) throw new ConfigError('MODEL_API_KEY is required when MODEL_MODE=live.');
    // API keys travel in the Authorization header: never over plain HTTP.
    for (const [k, v] of [['MODEL_API_BASE_URL', e.MODEL_API_BASE_URL], ['REVIEWER_API_BASE_URL', e.REVIEWER_API_BASE_URL]] as const) {
      if (v && new URL(v).protocol !== 'https:') throw new ConfigError(`${k} must use https when MODEL_MODE=live.`);
    }
  }
  return {
    mode: e.MODEL_MODE,
    worker: { baseUrl: e.MODEL_API_BASE_URL, apiKey: e.MODEL_API_KEY, model: w },
    reviewer: {
      baseUrl: e.REVIEWER_API_BASE_URL ?? e.MODEL_API_BASE_URL,
      apiKey: e.REVIEWER_API_KEY ?? e.MODEL_API_KEY,
      model: r,
    },
  };
}

/** HMAC key for approvals. Separate from AUTH_SECRET so rotating one doesn't affect the other. */
export function approvalSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.APPROVAL_SIGNING_SECRET;
  if (!s || s.length < 32) throw new ConfigError('APPROVAL_SIGNING_SECRET must be set (at least 32 characters).');
  return s;
}

export function allowedEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set(
    (env.ALLOWED_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Validates everything the server needs. Throws with variable names only, never values. */
export function assertServerConfig(env: Record<string, string | undefined> = process.env): void {
  loadModelConfig(env);
  if (env.NODE_ENV === 'production') {
    const missing = ['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'DATABASE_URL', 'ALLOWED_EMAILS', 'APPROVAL_SIGNING_SECRET'].filter(
      (k) => !env[k],
    );
    if (missing.length) throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);
    approvalSecret(env);
  }
}
