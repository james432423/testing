/**
 * Route-level auth and tenant isolation. Auth.js's auth() is replaced with a
 * stub that returns whichever session the test chooses; everything below it
 * (session -> workspace resolution, origin checks, validation, services,
 * gate, executor) is the real code against a real database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string; name: string } } }));
vi.mock('../src/auth.ts', () => ({ auth: vi.fn(async () => session.current), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }));

import { createTestDb, type TestDb } from './db.ts';
import { addUser } from './fixtures.ts';
import { setDbForTests } from '../src/lib/db/index.ts';
import { decisions, deals, rules, sentLog, tasks, users, workflows } from '../src/lib/db/schema.ts';
import * as decisionsRoute from '../src/app/api/decisions/route.ts';
import * as approveRoute from '../src/app/api/decisions/[id]/approve/route.ts';
import * as editRoute from '../src/app/api/decisions/[id]/edit-approve/route.ts';
import * as laterRoute from '../src/app/api/decisions/[id]/later/route.ts';
import * as tasksRoute from '../src/app/api/tasks/route.ts';
import * as handRoute from '../src/app/api/tasks/[id]/hand/route.ts';
import * as workflowsRoute from '../src/app/api/workflows/route.ts';
import * as workflowRoute from '../src/app/api/workflows/[id]/route.ts';
import * as runRoute from '../src/app/api/workflows/[id]/run/route.ts';
import * as rulesRoute from '../src/app/api/rules/route.ts';
import * as ruleRoute from '../src/app/api/rules/[id]/route.ts';
import * as sentRoute from '../src/app/api/sent/route.ts';
import * as appsRoute from '../src/app/api/apps/route.ts';
import * as dealsRoute from '../src/app/api/deals/route.ts';
import * as healthRoute from '../src/app/api/health/route.ts';
import * as prototypeRoute from '../src/app/app/[[...path]]/route.ts';

const ORIGIN = 'http://ida.test';
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

function call(h: unknown, method: string, path: string, opts: { body?: unknown; params?: Record<string, string>; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (opts.origin !== null && method !== 'GET') headers.origin = opts.origin ?? ORIGIN;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`${ORIGIN}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  return (h as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
}

const asUser = (id: string, email: string) => {
  session.current = { user: { id, email, name: id } };
};
const signedOut = () => {
  session.current = null;
};

let t: TestDb;
let A: { ws: string }, B: { ws: string };
const ids = { aDecision: '', aParksDecision: '', aWorkflow: '', aDeal: '', aRule: '', aLockedRule: '', aTask: '' };

beforeAll(async () => {
  t = await createTestDb();
  setDbForTests(t.db);
  A = await addUser(t, 'user-a', 'dana@example.com');
  B = await addUser(t, 'user-b', 'other@example.com');
  await t.db.insert(users).values({ id: 'user-x', email: 'notallowed@example.com' });
  const [d] = await t.db.select().from(decisions).where(and(eq(decisions.workspaceId, A.ws), eq(decisions.kind, 'ask')));
  const [p] = await t.db.select().from(decisions).where(and(eq(decisions.workspaceId, A.ws), eq(decisions.kind, 'approve')));
  const [wf] = await t.db.select().from(workflows).where(and(eq(workflows.workspaceId, A.ws), eq(workflows.key, 'inspection')));
  const [deal] = await t.db.select().from(deals).where(and(eq(deals.workspaceId, A.ws), eq(deals.key, 'hollis')));
  const [r] = await t.db.select().from(rules).where(and(eq(rules.workspaceId, A.ws), eq(rules.key, 'r-price')));
  const [lr] = await t.db.select().from(rules).where(and(eq(rules.workspaceId, A.ws), eq(rules.key, 'r-share')));
  const [tk] = await t.db.select().from(tasks).where(and(eq(tasks.workspaceId, A.ws), eq(tasks.canHand, true)));
  Object.assign(ids, { aDecision: d!.id, aParksDecision: p!.id, aWorkflow: wf!.id, aDeal: deal!.id, aRule: r!.id, aLockedRule: lr!.id, aTask: tk!.id });
});
afterAll(async () => {
  setDbForTests(undefined);
  await t.close();
});
beforeEach(() => signedOut());

describe('signed out', () => {
  it('health check is public', async () => {
    expect((await healthRoute.GET()).status).toBe(200);
  });

  const someId = '00000000-0000-4000-8000-000000000000';
  const cases: [string, unknown, string, Record<string, string>?, unknown?][] = [
    ['GET /api/decisions', decisionsRoute.GET, 'GET'],
    ['GET /api/tasks', tasksRoute.GET, 'GET'],
    ['GET /api/workflows', workflowsRoute.GET, 'GET'],
    ['GET /api/rules', rulesRoute.GET, 'GET'],
    ['GET /api/sent', sentRoute.GET, 'GET'],
    ['GET /api/apps', appsRoute.GET, 'GET'],
    ['GET /api/deals', dealsRoute.GET, 'GET'],
    ['POST approve', approveRoute.POST, 'POST', { id: someId }, {}],
    ['POST edit-approve', editRoute.POST, 'POST', { id: someId }, { body: 'x' }],
    ['POST later', laterRoute.POST, 'POST', { id: someId }, {}],
    ['POST /api/tasks', tasksRoute.POST, 'POST', {}, { name: 'Order yard signs' }],
    ['POST hand', handRoute.POST, 'POST', { id: someId }, {}],
    ['PATCH workflow', workflowRoute.PATCH, 'PATCH', { id: someId }, { level: 'auto' }],
    ['POST run', runRoute.POST, 'POST', { id: someId }, { dealId: someId }],
    ['POST /api/rules', rulesRoute.POST, 'POST', {}, { text: 'Never text after 9 pm', kind: 'never' }],
    ['PATCH rule', ruleRoute.PATCH, 'PATCH', { id: someId }, { enabled: false }],
    ['DELETE rule', ruleRoute.DELETE, 'DELETE', { id: someId }],
  ];
  it.each(cases)('%s -> 401', async (_n, h, method, params, body) => {
    const res = await call(h, method, '/api/x', { params, body });
    expect(res.status).toBe(401);
  });

  it('the prototype redirects to sign-in', async () => {
    const res = await (prototypeRoute.GET as unknown as Handler)(new Request(`${ORIGIN}/app/`), { params: Promise.resolve({}) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/signin`);
  });

  it('a session for an email no longer on ALLOWED_EMAILS is treated as signed out', async () => {
    asUser('user-x', 'notallowed@example.com');
    expect((await call(decisionsRoute.GET, 'GET', '/api/decisions')).status).toBe(401);
  });
});

describe('signed in', () => {
  it('lists only your own decisions', async () => {
    asUser('user-a', 'dana@example.com');
    const a = (await (await call(decisionsRoute.GET, 'GET', '/api/decisions')).json()) as { decisions: { id: string }[] };
    asUser('user-b', 'other@example.com');
    const b = (await (await call(decisionsRoute.GET, 'GET', '/api/decisions')).json()) as { decisions: { id: string }[] };
    expect(a.decisions).toHaveLength(3);
    expect(b.decisions).toHaveLength(3);
    expect(a.decisions.map((d) => d.id)).not.toEqual(expect.arrayContaining(b.decisions.map((d) => d.id).slice(0, 1)));
    expect(b.decisions.map((d) => d.id)).not.toContain(ids.aDecision);
  });

  it('rejects writes without a same-origin Origin header', async () => {
    asUser('user-a', 'dana@example.com');
    expect((await call(laterRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: {}, origin: null })).status).toBe(403);
    expect((await call(laterRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: {}, origin: 'https://evil.example' })).status).toBe(403);
  });

  it('validates params and bodies', async () => {
    asUser('user-a', 'dana@example.com');
    expect((await call(laterRoute.POST, 'POST', '/x', { params: { id: 'not-a-uuid' }, body: {} })).status).toBe(400);
    expect((await call(rulesRoute.POST, 'POST', '/x', { body: { text: 'ok text', kind: 'never', isAdmin: true } })).status).toBe(400);
    expect((await call(workflowRoute.PATCH, 'PATCH', '/x', { params: { id: ids.aWorkflow }, body: { level: 'yolo' } })).status).toBe(400);
  });

  it('owner approval through the route sends exactly what was shown', async () => {
    asUser('user-a', 'dana@example.com');
    const before = (await t.db.select().from(sentLog).where(and(eq(sentLog.workspaceId, A.ws), eq(sentLog.origin, 'executor')))).length;
    const stale = await call(approveRoute.POST, 'POST', '/x', { params: { id: ids.aParksDecision }, body: { contentHash: 'a'.repeat(64) } });
    expect(stale.status).toBe(409);
    // The hash is required: an approval must name the draft the owner saw.
    expect((await call(approveRoute.POST, 'POST', '/x', { params: { id: ids.aParksDecision }, body: {} })).status).toBe(400);
    const list = (await (await call(decisionsRoute.GET, 'GET', '/api/decisions')).json()) as { decisions: { id: string; action: { contentHash: string } }[] };
    const shown = list.decisions.find((d) => d.id === ids.aParksDecision)!.action.contentHash;
    const res = await call(approveRoute.POST, 'POST', '/x', { params: { id: ids.aParksDecision }, body: { contentHash: shown } });
    expect(res.status).toBe(200);
    const after = (await t.db.select().from(sentLog).where(and(eq(sentLog.workspaceId, A.ws), eq(sentLog.origin, 'executor')))).length;
    expect(after).toBe(before + 1);
    expect((await call(approveRoute.POST, 'POST', '/x', { params: { id: ids.aParksDecision }, body: { contentHash: shown } })).status).toBe(409);
  });

  it('edit and approve sends the edited version and keeps recipients fixed', async () => {
    asUser('user-a', 'dana@example.com');
    const bad = await call(editRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: { body: 'Hi', to: [{ name: 'x', email: 'x@example.com' }] } });
    expect(bad.status).toBe(400);
    const res = await call(editRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: { body: 'Hello,\n\nCould you send the payoff letter to Maya Ruiz at Lone Oak Title?\n\nDana' } });
    expect(res.status).toBe(200);
    const out = (await res.json()) as { sentId: string };
    const [row] = await t.db.select().from(sentLog).where(eq(sentLog.id, out.sentId));
    expect(row!.body).toContain('Could you send the payoff letter');
  });
});

describe('prototype', () => {
  const get = (parts: string[]) => (prototypeRoute.GET as unknown as (r: Request, c: { params: Promise<{ path?: string[] }> }) => Promise<Response>)(new Request(`${ORIGIN}/app/${parts.join('/')}`), { params: Promise.resolve({ path: parts }) });

  it('serves the prototype to a signed-in user with a hash-based CSP', async () => {
    asUser('user-a', 'dana@example.com');
    const res = await get([]);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toMatch(/script-src 'self'( 'sha256-[^']+')+;/);
    expect(res.headers.get('content-security-policy')).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('only serves files listed in the manifest', async () => {
    asUser('user-a', 'dana@example.com');
    for (const parts of [['..', 'package.json'], ['..', '.env'], ['manifest.json'], ['%2e%2e', 'package.json'], ['nope.html']]) {
      expect((await get(parts)).status).toBe(404);
    }
    expect((await get(['tasks'])).status).toBe(200);
  });
});

describe('cross-tenant access is denied', () => {
  beforeEach(() => asUser('user-b', 'other@example.com'));

  it('cannot approve, edit or defer another workspace decision', async () => {
    expect((await call(approveRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: { contentHash: 'a'.repeat(64) } })).status).toBe(404);
    expect((await call(editRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: { body: 'pwned' } })).status).toBe(404);
    expect((await call(laterRoute.POST, 'POST', '/x', { params: { id: ids.aDecision }, body: {} })).status).toBe(404);
  });

  it('cannot change, pause or run another workspace workflow', async () => {
    expect((await call(workflowRoute.PATCH, 'PATCH', '/x', { params: { id: ids.aWorkflow }, body: { level: 'auto' } })).status).toBe(404);
    expect((await call(workflowRoute.PATCH, 'PATCH', '/x', { params: { id: ids.aWorkflow }, body: { paused: true } })).status).toBe(404);
    expect((await call(runRoute.POST, 'POST', '/x', { params: { id: ids.aWorkflow }, body: { dealId: ids.aDeal } })).status).toBe(404);
    const [wf] = await t.db.select().from(workflows).where(eq(workflows.id, ids.aWorkflow));
    expect(wf!.trustLevel).toBe('approve');
    expect(wf!.paused).toBe(false);
  });

  it('cannot run its own workflow on another workspace deal', async () => {
    const [own] = await t.db.select().from(workflows).where(and(eq(workflows.workspaceId, B.ws), eq(workflows.key, 'inspection')));
    expect((await call(runRoute.POST, 'POST', '/x', { params: { id: own!.id }, body: { dealId: ids.aDeal } })).status).toBe(404);
  });

  it('cannot edit or delete another workspace rule, or hand off its task', async () => {
    expect((await call(ruleRoute.PATCH, 'PATCH', '/x', { params: { id: ids.aRule }, body: { enabled: false } })).status).toBe(404);
    expect((await call(ruleRoute.DELETE, 'DELETE', '/x', { params: { id: ids.aRule } })).status).toBe(404);
    expect((await call(handRoute.POST, 'POST', '/x', { params: { id: ids.aTask }, body: {} })).status).toBe(404);
    const [r] = await t.db.select().from(rules).where(eq(rules.id, ids.aRule));
    expect(r!.enabled).toBe(true);
  });

  it('sees none of the other workspace sent log', async () => {
    const res = (await (await call(sentRoute.GET, 'GET', '/api/sent')).json()) as { sent: { id: string }[] };
    const aSent = (await t.db.select().from(sentLog).where(eq(sentLog.workspaceId, A.ws))).map((s) => s.id);
    expect(res.sent.some((s) => aSent.includes(s.id))).toBe(false);
  });
});

describe('rules, tasks, workflows', () => {
  beforeEach(() => asUser('user-a', 'dana@example.com'));

  it('rule CRUD, and locked rules cannot change', async () => {
    const created = await call(rulesRoute.POST, 'POST', '/x', { body: { text: 'Before texting a client after 8 pm', kind: 'ask_first', keywords: ['tonight'] } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    expect((await call(ruleRoute.PATCH, 'PATCH', '/x', { params: { id }, body: { enabled: false } })).status).toBe(200);
    expect((await call(ruleRoute.DELETE, 'DELETE', '/x', { params: { id } })).status).toBe(200);
    expect((await call(ruleRoute.PATCH, 'PATCH', '/x', { params: { id: ids.aLockedRule }, body: { enabled: false } })).status).toBe(403);
    expect((await call(ruleRoute.DELETE, 'DELETE', '/x', { params: { id: ids.aLockedRule } })).status).toBe(403);
  });

  it('adds a task and hands it to Ida as a practice workflow', async () => {
    const res = await call(tasksRoute.POST, 'POST', '/x', { body: { name: 'Order yard signs for new listings', area: 'Listings', handToIda: true } });
    const out = (await res.json()) as { workflowId: string };
    const [wf] = await t.db.select().from(workflows).where(eq(workflows.id, out.workflowId));
    expect(wf!.trustLevel).toBe('practice');
    expect(wf!.workspaceId).toBe(A.ws);
  });

  it('changes a workflow level and pauses it', async () => {
    const res = await call(workflowRoute.PATCH, 'PATCH', '/x', { params: { id: ids.aWorkflow }, body: { level: 'practice', paused: true } });
    expect(await res.json()).toMatchObject({ level: 'practice', paused: true });
  });

  it('rate limits writes', async () => {
    const someId = '00000000-0000-4000-8000-000000000000';
    let last = 0;
    for (let i = 0; i < 65; i++) last = (await call(laterRoute.POST, 'POST', '/x', { params: { id: someId }, body: {} })).status;
    expect(last).toBe(429);
  });
});

describe('security review fixes (routes)', () => {
  beforeEach(() => asUser('user-b', 'other@example.com'));

  it('refuses a body over 64 KB by declared length and by real UTF-8 bytes', async () => {
    const huge = new Request(`${ORIGIN}/x`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'content-length': String(10 * 1024 * 1024) }, body: '{}' });
    expect((await (rulesRoute.POST as unknown as Handler)(huge, { params: Promise.resolve({}) })).status).toBe(413);
    // 30k three-byte characters: under 64k string length, about 90 KB on the wire.
    const multibyte = await call(rulesRoute.POST, 'POST', '/x', { body: { text: '€'.repeat(30_000), kind: 'never' } });
    expect(multibyte.status).toBe(413);
  });

  it('serves prototype assets with a lock-down CSP', async () => {
    const res = await (prototypeRoute.GET as unknown as (r: Request, c: { params: Promise<{ path?: string[] }> }) => Promise<Response>)(new Request(`${ORIGIN}/app/tasks.js`), { params: Promise.resolve({ path: ['tasks.js'] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toMatch(/^default-src 'none'/);
  });
});
