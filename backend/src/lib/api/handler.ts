/**
 * Every API route goes through apiRoute(). It enforces, in order:
 *   1. same-origin + JSON content type on writes (CSRF defense in depth on
 *      top of SameSite=Lax session cookies),
 *   2. a server-side Auth.js session (401 otherwise),
 *   3. per-user rate limits on writes,
 *   4. zod validation of params and body (400 otherwise; 64 KB body cap),
 * and hands the handler a workspace-scoped HumanSession. Errors never leak
 * internals: unknown errors become a generic 500.
 */
import { z } from 'zod';
import { getDb, type Db } from '../db/index.ts';
import type { HumanSession } from '../gate/approvals.ts';
import { GateError } from '../gate/pipeline.ts';
import { ApprovalError } from '../gate/approvals.ts';
import { ExecutorRefusal } from '../executor/errors.ts';
import { hit, LIMITS, type Limit } from '../ratelimit.ts';
import { HttpError } from './errors.ts';
import { requireHuman } from './session.ts';
import { safeErrorSummary } from '../log.ts';

const MAX_BODY_BYTES = 64 * 1024;

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

export type ApiContext<B, P> = { req: Request; db: Db; human: HumanSession; body: B; params: P };

type Options<B, P> = {
  write?: boolean;
  body?: z.ZodType<B, z.ZodTypeDef, unknown>;
  params?: z.ZodType<P, z.ZodTypeDef, unknown>;
  limit?: { bucket: string; limit: Limit };
};

const NO_STORE = { 'cache-control': 'no-store' };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

function error(status: number, code: string, message?: string): Response {
  return json({ error: code, ...(message ? { message } : {}) }, status);
}

/** Origin must match the host the request was sent to (or AUTH_URL when set). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set<string>([new URL(req.url).origin]);
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  if (host) allowed.add(`${proto}://${host}`);
  if (process.env.AUTH_URL) {
    try {
      allowed.add(new URL(process.env.AUTH_URL).origin);
    } catch {
      /* ignore malformed AUTH_URL */
    }
  }
  return allowed.has(origin);
}

export function apiRoute<B = undefined, P = Record<string, never>>(opts: Options<B, P>, fn: (ctx: ApiContext<B, P>) => Promise<unknown>) {
  return async (req: Request, routeCtx?: RouteContext): Promise<Response> => {
    try {
      if (opts.write) {
        if (!sameOrigin(req)) return error(403, 'bad_origin');
        if (opts.body && !(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
          return error(415, 'json_required');
        }
      }

      const db = getDb();
      const human = await requireHuman(db);
      if (!human) return error(401, 'unauthenticated');

      if (opts.write || opts.limit) {
        const l = opts.limit ?? { bucket: 'write', limit: LIMITS.write };
        const r = await hit(db, `${l.bucket}:${human.userId}`, l.limit);
        if (!r.ok) return json({ error: 'rate_limited' }, 429);
      }

      const rawParams = routeCtx ? await routeCtx.params : {};
      let params = {} as P;
      if (opts.params) {
        const p = opts.params.safeParse(rawParams);
        if (!p.success) return error(400, 'bad_params');
        params = p.data;
      }

      let body = undefined as B;
      if (opts.body) {
        // Refuse oversized bodies before reading them, then count real bytes
        // (string length undercounts multi-byte UTF-8).
        const declared = Number(req.headers.get('content-length') ?? '0');
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return error(413, 'too_large');
        const text = await req.text();
        if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return error(413, 'too_large');
        let data: unknown;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          return error(400, 'bad_json');
        }
        const b = opts.body.safeParse(data);
        if (!b.success) {
          return json({ error: 'bad_body', issues: b.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400);
        }
        body = b.data;
      }

      const out = await fn({ req, db, human, body, params });
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.code, e.message !== e.code ? e.message : undefined);
      if (e instanceof GateError) return error(e.status, 'gate_error', e.message);
      if (e instanceof ApprovalError) return error(409, 'approval_error', e.message);
      if (e instanceof ExecutorRefusal) return error(409, 'not_sent', e.code);
      console.error('api error', safeErrorSummary(e));
      return error(500, 'internal');
    }
  };
}

export const IdParams = z.object({ id: z.string().uuid() }).strict();
