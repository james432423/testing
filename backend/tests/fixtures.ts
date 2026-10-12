import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from './db.ts';
import { deals, dealContacts, sources, users, workflows } from '../src/lib/db/schema.ts';
import { ensureWorkspaceForUser } from '../src/lib/seed/seed.ts';
import type { HumanSession } from '../src/lib/gate/approvals.ts';
import type { ModelClient } from '../src/lib/models/client.ts';
import type { ActionContent } from '../src/lib/gate/action.ts';

export type World = {
  t: TestDb;
  ws: string;
  human: HumanSession;
  wf: Record<string, string>;
  deal: Record<string, string>;
  src: Record<string, string>;
};

export async function addUser(t: TestDb, id: string, email: string): Promise<{ ws: string; human: HumanSession }> {
  await t.db.insert(users).values({ id, email, name: id });
  const ws = await ensureWorkspaceForUser(t.db, { id });
  return { ws, human: { userId: id, workspaceId: ws } as HumanSession };
}

export async function makeWorld(t?: TestDb): Promise<World> {
  t ??= await createTestDb();
  const { ws, human } = await addUser(t, 'user-a', 'dana@example.com');
  const wf = Object.fromEntries((await t.db.select().from(workflows).where(eq(workflows.workspaceId, ws))).map((w) => [w.key, w.id]));
  const deal = Object.fromEntries((await t.db.select().from(deals).where(eq(deals.workspaceId, ws))).map((d) => [d.key, d.id]));
  const src = Object.fromEntries((await t.db.select().from(sources).where(eq(sources.workspaceId, ws))).map((s) => [s.key, s.id]));
  return { t, ws, human, wf, deal, src };
}

export function reviewerReturning(raw: string | (() => string), seen?: string[]): ModelClient {
  return {
    role: 'reviewer',
    model: 'test-reviewer/x',
    complete: async (messages) => {
      seen?.push(messages.map((m) => m.content).join('\n'));
      return typeof raw === 'function' ? raw() : raw;
    },
  };
}

export const APPROVE = JSON.stringify({ verdict: 'approve', reasons: ['ok'] });

/** A clean, fully cited email to the Okafors about 9 Hollis Way. */
export function cleanHollisEmail(w: World): ActionContent {
  return {
    type: 'send_email',
    to: [{ name: 'Ruth Okafor', email: 'ruth.okafor@example.com' }],
    cc: [],
    subject: 'Water heater at 9 Hollis Way',
    body: 'Hi Ruth,\n\nThe inspector noted the water heater is 14 years old and near the end of its service life. I will ask the sellers about it.\n\nDana',
    citations: [
      {
        sourceId: w.src['hollis-inspection']!,
        page: 12,
        quote: 'Water heater is 14 years old and near the end of its service life.',
        claim: 'the water heater is 14 years old and near the end of its service life',
      },
    ],
  };
}

export async function contactEmails(t: TestDb, dealId: string): Promise<string[]> {
  return (await t.db.select().from(dealContacts).where(eq(dealContacts.dealId, dealId))).map((c) => c.email);
}
