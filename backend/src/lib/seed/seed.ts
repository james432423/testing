/**
 * Loads the Dana Reyes sample world into a workspace. The open decisions are
 * created by running drafts through the real gate (with the mock reviewer),
 * so seeded data obeys the same invariants as live data.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import {
  apps,
  dealContacts,
  deals,
  recipientAllowlist,
  rules,
  sentLog,
  sources,
  tasks,
  workflows,
  workspaceMembers,
  workspaces,
} from '../db/schema.ts';
import { audit } from '../audit.ts';
import { createModelClient, type ModelClient } from '../models/client.ts';
import { submitProposal } from '../gate/pipeline.ts';
import { loadModelConfig } from '../env.ts';
import { ALLOWLIST, APPS, DEALS, DECISIONS, OWNER, RULES, SENT_HISTORY, SOURCES, TASKS, WORKFLOWS } from './sample-world.ts';

/** A reviewer that always uses the built-in mock, so seeding never calls a paid API. */
function seedReviewer(): ModelClient {
  const cfg = loadModelConfig({ ...process.env, MODEL_MODE: 'mock' });
  return createModelClient('reviewer', { config: cfg });
}

export async function seedWorkspace(db: Db, workspaceId: string, now = new Date()): Promise<void> {
  const dealIds = new Map<string, string>();
  for (const d of DEALS) {
    const [row] = await db.insert(deals).values({ workspaceId, key: d.key, name: d.name, side: d.side, statusText: d.status }).returning({ id: deals.id });
    dealIds.set(d.key, row!.id);
    await db.insert(dealContacts).values(d.people.map((p) => ({ workspaceId, dealId: row!.id, name: p.name, role: p.role, email: p.email })));
  }
  await db.insert(recipientAllowlist).values(ALLOWLIST.map((a) => ({ workspaceId, ...a })));

  const sourceIds = new Map<string, string>();
  for (const s of SOURCES) {
    const [row] = await db
      .insert(sources)
      .values({ workspaceId, dealId: dealIds.get(s.deal) ?? null, key: s.key, kind: s.kind, title: s.title, meta: s.meta, pageCount: s.pageCount, pages: s.pages })
      .returning({ id: sources.id });
    sourceIds.set(s.key, row!.id);
  }

  await db.insert(apps).values(APPS.map((a) => ({ workspaceId, ...a })));

  const wfIds = new Map<string, string>();
  for (const w of WORKFLOWS) {
    const [row] = await db
      .insert(workflows)
      .values({ workspaceId, key: w.key, name: w.name, whenText: w.when, doesText: w.does, trustLevel: w.level, appKeys: w.apps })
      .returning({ id: workflows.id });
    wfIds.set(w.key, row!.id);
  }

  await db.insert(tasks).values(
    TASKS.map((t) => ({
      workspaceId,
      name: t.name,
      area: t.area,
      workflowId: t.wf ? wfIds.get(t.wf)! : null,
      ownLevel: t.ownLevel ?? 'yours',
      canHand: !!t.canHand,
      keep: !!t.keep,
      note: t.note ?? '',
      hoursPerWeek: t.hours ?? 0,
    })),
  );

  await db.insert(rules).values(RULES.map((r) => ({ workspaceId, key: r.key, kind: r.kind, text: r.text, source: r.source, locked: !!r.locked, matchers: r.matchers })));

  for (const h of SENT_HISTORY) {
    const at = new Date(now);
    at.setDate(at.getDate() - h.daysAgo);
    const [hh, mm] = h.time.split(':').map(Number);
    at.setHours(hh!, mm!, 0, 0);
    await db.insert(sentLog).values({
      workspaceId,
      origin: 'sample_history',
      workflowId: wfIds.get(h.wf) ?? null,
      dealId: dealIds.get(h.deal) ?? null,
      how: h.how,
      recipients: { to: [{ name: h.to }], cc: [] },
      subject: h.subject,
      body: h.body,
      sentAt: at,
    });
  }

  // Open decisions, through the real gate.
  const reviewer = seedReviewer();
  for (const d of DECISIONS) {
    const dealKey = d.deal;
    const deal = DEALS.find((x) => x.key === dealKey)!;
    const contact = (email: string) => {
      const p = deal.people.find((x) => x.email === email);
      if (!p) throw new Error(`seed: ${email} is not on ${deal.name}`);
      return { name: p.name, email: p.email };
    };
    await submitProposal(db, { reviewer, now: () => now }, {
      workspaceId,
      workflowId: wfIds.get(d.wf)!,
      dealId: dealIds.get(dealKey)!,
      author: 'worker',
      authorRef: 'seed',
      decision: d.copy,
      content: {
        type: d.type,
        to: [...d.to.map(contact), ...(d.extraTo ?? [])],
        cc: (d.cc ?? []).map(contact),
        subject: d.subject,
        body: d.body,
        citations: d.citations.map((c) => ({ sourceId: sourceIds.get(c.source)!, page: c.page, quote: c.quote, claim: c.claim })),
      },
    });
  }

  await audit(db, { workspaceId, actorKind: 'system', event: 'workspace.seeded', data: { world: 'dana-reyes-v1' } });
}

/**
 * Creates the user's workspace and loads the sample world, once. Safe to call
 * on every request: it returns the existing workspace if there is one.
 */
export async function ensureWorkspaceForUser(db: Db, user: { id: string; name?: string | null }): Promise<string> {
  const [existing] = await db.select({ ws: workspaceMembers.workspaceId }).from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));
  if (existing) return existing.ws;
  const workspaceId = await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    const [ws] = await t.insert(workspaces).values({ name: OWNER.business, ownerName: OWNER.name }).returning({ id: workspaces.id });
    // The unique index on user_id makes a concurrent second provision fail here and roll back.
    await t.insert(workspaceMembers).values({ workspaceId: ws!.id, userId: user.id, role: 'owner' });
    await seedWorkspace(t, ws!.id);
    await audit(t, { workspaceId: ws!.id, actorKind: 'system', event: 'workspace.created', actorId: user.id });
    return ws!.id;
  }).catch(async (e) => {
    const [again] = await db.select({ ws: workspaceMembers.workspaceId }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, user.id)));
    if (again) return again.ws;
    throw e;
  });
  return workspaceId;
}
