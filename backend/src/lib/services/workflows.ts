import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { dealContacts, deals, rules, sources, workflows } from '../db/schema.ts';
import type { HumanSession } from '../gate/approvals.ts';
import { audit } from '../audit.ts';
import { notFound } from '../api/errors.ts';
import { createModelClient } from '../models/client.ts';
import { submitProposal, workspaceOwnerName } from '../gate/pipeline.ts';
import { runWorker, type WorkerContext } from '../worker/worker.ts';

export async function listWorkflows(db: Db, h: HumanSession) {
  const rows = await db.select().from(workflows).where(eq(workflows.workspaceId, h.workspaceId)).orderBy(asc(workflows.createdAt));
  return rows.map((w) => ({ id: w.id, key: w.key, name: w.name, when: w.whenText, does: w.doesText, level: w.trustLevel, paused: w.paused, apps: w.appKeys }));
}

export async function updateWorkflow(db: Db, h: HumanSession, id: string, patch: { level?: 'practice' | 'approve' | 'auto'; paused?: boolean }) {
  const [before] = await db.select().from(workflows).where(and(eq(workflows.id, id), eq(workflows.workspaceId, h.workspaceId)));
  if (!before) throw notFound();
  const [after] = await db
    .update(workflows)
    .set({ ...(patch.level ? { trustLevel: patch.level } : {}), ...(patch.paused !== undefined ? { paused: patch.paused } : {}), updatedAt: new Date() })
    .where(and(eq(workflows.id, id), eq(workflows.workspaceId, h.workspaceId)))
    .returning();
  await audit(db, {
    workspaceId: h.workspaceId,
    actorKind: 'user',
    actorId: h.userId,
    event: 'workflow.updated',
    subjectType: 'workflow',
    subjectId: id,
    data: { from: { level: before.trustLevel, paused: before.paused }, to: { level: after!.trustLevel, paused: after!.paused } },
  });
  return { id, level: after!.trustLevel, paused: after!.paused };
}

/** Runs the worker once for a deal and sends its draft through the gate. */
export async function runWorkflowOnce(db: Db, h: HumanSession, workflowId: string, dealId: string) {
  const [wf] = await db.select().from(workflows).where(and(eq(workflows.id, workflowId), eq(workflows.workspaceId, h.workspaceId)));
  const [deal] = await db.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.workspaceId, h.workspaceId)));
  if (!wf || !deal) throw notFound();
  const contacts = await db.select().from(dealContacts).where(and(eq(dealContacts.workspaceId, h.workspaceId), eq(dealContacts.dealId, dealId)));
  const srcs = await db.select().from(sources).where(and(eq(sources.workspaceId, h.workspaceId), eq(sources.dealId, dealId)));
  const rs = await db.select().from(rules).where(and(eq(rules.workspaceId, h.workspaceId), eq(rules.enabled, true)));

  const ctx: WorkerContext = {
    workflow: { id: wf.id, name: wf.name, does: wf.doesText },
    deal: { id: deal.id, name: deal.name, status: deal.statusText },
    contacts: contacts.map((c) => ({ name: c.name, email: c.email, role: c.role })),
    sources: srcs.map((s) => ({ id: s.id, title: s.title, pages: s.pages })),
    rules: rs.map((r) => ({ kind: r.kind, text: r.text })),
    ownerName: await workspaceOwnerName(db, h.workspaceId),
  };
  const worker = createModelClient('worker');
  const reviewer = createModelClient('reviewer');
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'worker.run_requested', subjectType: 'workflow', subjectId: wf.id, data: { dealId } });
  return runWorker(worker, ctx, {
    propose: async (proposal) => {
      const r = await submitProposal(db, { reviewer }, {
        workspaceId: h.workspaceId,
        workflowId: wf.id,
        dealId: deal.id,
        author: 'worker',
        authorRef: worker.model,
        content: proposal.action,
        notes: proposal.notes,
      });
      return { actionId: r.actionId, status: r.status };
    },
  });
}
