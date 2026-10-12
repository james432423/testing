import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { apps, deals, sentLog, workflows } from '../db/schema.ts';
import type { HumanSession } from '../gate/approvals.ts';

export async function listSent(db: Db, h: HumanSession) {
  const rows = await db
    .select({ s: sentLog, deal: deals.name, workflow: workflows.name })
    .from(sentLog)
    .leftJoin(deals, and(eq(deals.id, sentLog.dealId), eq(deals.workspaceId, h.workspaceId)))
    .leftJoin(workflows, and(eq(workflows.id, sentLog.workflowId), eq(workflows.workspaceId, h.workspaceId)))
    .where(eq(sentLog.workspaceId, h.workspaceId))
    .orderBy(desc(sentLog.sentAt))
    .limit(200);
  return rows.map(({ s, deal, workflow }) => ({
    id: s.id,
    sentAt: s.sentAt,
    how: s.how,
    origin: s.origin,
    deal,
    workflow,
    recipients: s.recipients,
    subject: s.subject,
    body: s.body,
    actionId: s.actionId,
  }));
}

/** Connected apps are a stub in this build: listing only, no OAuth to third parties yet. */
export async function listApps(db: Db, h: HumanSession) {
  const rows = await db.select().from(apps).where(eq(apps.workspaceId, h.workspaceId)).orderBy(asc(apps.name));
  return rows.map((a) => ({ id: a.id, key: a.key, name: a.name, status: a.status, description: a.description }));
}

export async function listDeals(db: Db, h: HumanSession) {
  return db.select({ id: deals.id, key: deals.key, name: deals.name, side: deals.side, status: deals.statusText }).from(deals).where(eq(deals.workspaceId, h.workspaceId)).orderBy(asc(deals.name));
}
