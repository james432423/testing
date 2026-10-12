/**
 * Fixed-window rate limiter stored in Postgres (no extra service). One
 * atomic upsert per check. Good enough for a private beta; swap for Upstash
 * or Vercel WAF rules if traffic grows.
 */
import { sql } from 'drizzle-orm';
import type { Db } from './db/index.ts';

export type Limit = { max: number; windowSec: number };

export const LIMITS = {
  auth: { max: 20, windowSec: 60 },
  write: { max: 60, windowSec: 60 },
  run: { max: 10, windowSec: 60 },
} satisfies Record<string, Limit>;

export async function hit(db: Db, key: string, limit: Limit): Promise<{ ok: boolean; count: number }> {
  const res = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${limit.windowSec}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${limit.windowSec}) THEN now() ELSE rate_limits.window_start END
    RETURNING count`);
  const rows = (res as unknown as { rows: { count: number | string }[] }).rows;
  const count = Number(rows[0]?.count ?? 0);
  return { ok: count <= limit.max, count };
}

/**
 * Client IP for rate limiting.
 *
 * The left-most X-Forwarded-For entry is whatever the client sent, so it is
 * never trusted on its own: rotating it would give an attacker a fresh rate
 * limit bucket on every request.
 *   - On Vercel (VERCEL=1) the edge overwrites x-real-ip / x-forwarded-for
 *     with the address it saw, so x-real-ip is used.
 *   - Anywhere else, the right-most X-Forwarded-For entry is used: it was
 *     added by the proxy closest to us, not by the client.
 */
export function clientIp(req: Request, env: Record<string, string | undefined> = process.env): string {
  const clean = (s: string | null | undefined) => (s ?? '').trim().slice(0, 64);
  if (env.VERCEL) {
    const real = clean(req.headers.get('x-real-ip'));
    if (real) return real;
  }
  const hops = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return clean(hops[hops.length - 1]) || 'unknown';
}
