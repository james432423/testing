import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { actionReviews, apps, deals, decisions, proposedActions, sources, workflows } from '../db/schema.ts';
import { ActionContent } from '../gate/action.ts';
import { issueOwnerApproval, type HumanSession } from '../gate/approvals.ts';
import { loadGateContext, recordAction } from '../gate/pipeline.ts';
import { execute } from '../executor/executor.ts';
import { audit } from '../audit.ts';
import { conflict, HttpError, notFound } from '../api/errors.ts';

export async function listDecisions(db: Db, h: HumanSession, status: 'open' | 'later' | 'done' | 'all' = 'open') {
  const where = status === 'all' ? eq(decisions.workspaceId, h.workspaceId) : and(eq(decisions.workspaceId, h.workspaceId), eq(decisions.status, status));
  const rows = await db
    .select({ d: decisions, a: proposedActions, deal: deals.name, workflow: workflows.name })
    .from(decisions)
    .innerJoin(proposedActions, and(eq(proposedActions.id, decisions.actionId), eq(proposedActions.workspaceId, h.workspaceId)))
    .leftJoin(deals, and(eq(deals.id, decisions.dealId), eq(deals.workspaceId, h.workspaceId)))
    .leftJoin(workflows, and(eq(workflows.id, decisions.workflowId), eq(workflows.workspaceId, h.workspaceId)))
    .where(where)
    .orderBy(desc(decisions.createdAt))
    .limit(100);
  if (!rows.length) return [];

  const actionIds = rows.map((r) => r.a.id);
  const reviews = await db
    .select()
    .from(actionReviews)
    .where(and(eq(actionReviews.workspaceId, h.workspaceId), inArray(actionReviews.actionId, actionIds)));
  const srcIds = [...new Set(rows.flatMap((r) => ((r.a.content as ActionContent).citations ?? []).map((c) => c.sourceId)))];
  const srcRows = srcIds.length
    ? await db.select({ id: sources.id, title: sources.title, meta: sources.meta }).from(sources).where(and(eq(sources.workspaceId, h.workspaceId), inArray(sources.id, srcIds)))
    : [];
  const srcById = new Map(srcRows.map((s) => [s.id, s]));
  const appRows = await db.select({ key: apps.key, name: apps.name, status: apps.status }).from(apps).where(eq(apps.workspaceId, h.workspaceId));
  const appByKey = new Map(appRows.map((a) => [a.key, a]));

  return rows.map(({ d, a, deal, workflow }) => {
    const c = a.content as ActionContent;
    const blockedApp = d.blockedByApp ? appByKey.get(d.blockedByApp) : undefined;
    const blocked = blockedApp && blockedApp.status !== 'connected' ? { app: blockedApp.key, name: blockedApp.name } : null;
    const rv = reviews.filter((r) => r.actionId === a.id && r.contentHash === a.contentHash);
    return {
      id: d.id,
      kind: d.kind,
      question: d.question,
      primaryLabel: d.primaryLabel,
      status: d.status,
      reason: d.reason,
      blocked,
      deal,
      workflow,
      createdAt: d.createdAt,
      action: {
        id: a.id,
        contentHash: a.contentHash,
        type: c.type,
        to: c.to,
        cc: c.cc,
        subject: c.subject,
        body: c.body,
        citations: c.citations.map((ci) => ({ ...ci, source: srcById.get(ci.sourceId) ?? null })),
      },
      checks: {
        policy: rv.find((r) => r.reviewer === 'policy')?.findings ?? [],
        reviewer: rv.find((r) => r.reviewer === 'model') ? { verdict: rv.find((r) => r.reviewer === 'model')!.verdict, ...(rv.find((r) => r.reviewer === 'model')!.findings as object) } : null,
      },
    };
  });
}

async function loadOpenDecision(db: Db, h: HumanSession, id: string) {
  const [d] = await db.select().from(decisions).where(and(eq(decisions.id, id), eq(decisions.workspaceId, h.workspaceId)));
  if (!d) throw notFound();
  if (d.status !== 'open' && d.status !== 'later') throw conflict(`This decision is already ${d.status}.`);
  if (d.blockedByApp) {
    const [app] = await db.select().from(apps).where(and(eq(apps.workspaceId, h.workspaceId), eq(apps.key, d.blockedByApp)));
    if (app && app.status !== 'connected') throw conflict(`Reconnect ${app.name} first.`);
  }
  return d;
}

/**
 * Owner approves exactly what they saw: the client must send the content hash
 * of the draft it displayed, and the approval is bound to that hash.
 */
export async function approveDecision(db: Db, h: HumanSession, id: string, expectedHash: string) {
  const d = await loadOpenDecision(db, h, id);
  const [a] = await db.select({ h: proposedActions.contentHash }).from(proposedActions).where(and(eq(proposedActions.id, d.actionId), eq(proposedActions.workspaceId, h.workspaceId)));
  if (!a || a.h !== expectedHash) throw conflict('The draft changed since you opened it.');
  const approval = await issueOwnerApproval(db, h, d.actionId);
  const sent = await execute(db, { workspaceId: h.workspaceId, approvalId: approval.id });
  return { decisionId: d.id, sentId: sent.sentId };
}

/** Owner edits subject/body (never recipients), which creates a new immutable version, then approves it. */
export async function editAndApprove(db: Db, h: HumanSession, id: string, edit: { subject?: string; body?: string }) {
  const d = await loadOpenDecision(db, h, id);
  const [old] = await db.select().from(proposedActions).where(and(eq(proposedActions.id, d.actionId), eq(proposedActions.workspaceId, h.workspaceId)));
  if (!old) throw notFound();
  if (old.status !== 'awaiting_owner') throw conflict(`This draft is ${old.status}.`);
  const prev = ActionContent.parse(old.content);
  const next = ActionContent.safeParse({ ...prev, subject: edit.subject ?? prev.subject, body: edit.body ?? prev.body });
  if (!next.success) throw new HttpError(400, 'bad_body', 'The edited draft is not valid.');
  const content = next.data;
  const ctx = await loadGateContext(db, h.workspaceId, old.workflowId, old.dealId, content.citations.map((c) => c.sourceId));
  // Claim the old version atomically before anything else. Of two concurrent
  // edits, or an edit racing an approve, only one can move it out of
  // awaiting_owner, so one decision can never send twice.
  const claimed = await db
    .update(proposedActions)
    .set({ status: 'superseded', updatedAt: new Date() })
    .where(and(eq(proposedActions.id, old.id), eq(proposedActions.workspaceId, h.workspaceId), eq(proposedActions.status, 'awaiting_owner')))
    .returning({ id: proposedActions.id });
  if (claimed.length !== 1) throw conflict('This draft was already handled.');
  const { actionId, policy } = await recordAction(
    db,
    { workspaceId: h.workspaceId, workflowId: old.workflowId, dealId: old.dealId, author: 'owner', authorRef: h.userId, parentId: old.id, content },
    ctx,
  );
  await db.update(proposedActions).set({ status: 'awaiting_owner', updatedAt: new Date() }).where(and(eq(proposedActions.id, actionId), eq(proposedActions.workspaceId, h.workspaceId)));
  await db.update(decisions).set({ actionId }).where(and(eq(decisions.id, d.id), eq(decisions.workspaceId, h.workspaceId)));
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'decision.edited', subjectType: 'decision', subjectId: d.id, data: { from: old.id, to: actionId, policyFindings: policy.findings } });
  const approval = await issueOwnerApproval(db, h, actionId);
  const sent = await execute(db, { workspaceId: h.workspaceId, approvalId: approval.id });
  return { decisionId: d.id, actionId, sentId: sent.sentId, policyFindings: policy.findings };
}

export async function notNow(db: Db, h: HumanSession, id: string) {
  const [d] = await db.select().from(decisions).where(and(eq(decisions.id, id), eq(decisions.workspaceId, h.workspaceId)));
  if (!d) throw notFound();
  if (d.status !== 'open') throw conflict(`This decision is ${d.status}.`);
  await db.update(decisions).set({ status: 'later' }).where(and(eq(decisions.id, id), eq(decisions.workspaceId, h.workspaceId)));
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'decision.later', subjectType: 'decision', subjectId: id });
  return { decisionId: id, status: 'later' };
}
