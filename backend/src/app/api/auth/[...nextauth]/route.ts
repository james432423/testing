/** Auth.js endpoints, rate limited per client IP. */
import { handlers } from '../../../../auth.ts';
import { getDb } from '../../../../lib/db/index.ts';
import { clientIp, hit, LIMITS } from '../../../../lib/ratelimit.ts';
import { safeErrorSummary } from '../../../../lib/log.ts';

type Handler = (req: Request) => Promise<Response>;

function limited(h: Handler): Handler {
  return async (req) => {
    let r: { ok: boolean };
    try {
      r = await hit(getDb(), `auth:${clientIp(req)}`, LIMITS.auth);
    } catch (e) {
      // Fail closed, and log without the query parameters (the client IP).
      console.error('auth rate limit unavailable', safeErrorSummary(e));
      return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    if (!r.ok) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'retry-after': '60' } });
    return h(req);
  };
}

export const GET = limited(handlers.GET as unknown as Handler);
export const POST = limited(handlers.POST as unknown as Handler);
