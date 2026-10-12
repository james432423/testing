import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { tasks, workflows } from '../db/schema.ts';
import type { HumanSession } from '../gate/approvals.ts';
import { audit } from '../audit.ts';
import { conflict, notFound } from '../api/errors.ts';

export async function listTasks(db: Db, h: HumanSession) {
  const rows = await db
    .select({ t: tasks, wfName: workflows.name, wfLevel: workflows.trustLevel, wfPaused: workflows.paused })
    .from(tasks)
    .leftJoin(workflows, and(eq(workflows.id, tasks.workflowId), eq(workflows.workspaceId, h.workspaceId)))
    .where(eq(tasks.workspaceId, h.workspaceId))
    .orderBy(asc(tasks.createdAt));
  return rows.map(({ t, wfName, wfLevel, wfPaused }) => ({
    id: t.id,
    name: t.name,
    area: t.area,
    level: t.workflowId ? wfLevel : t.ownLevel,
    workflow: t.workflowId ? { id: t.workflowId, name: wfName, paused: wfPaused } : null,
    canHand: t.canHand && !t.keep && !t.workflowId,
    keep: t.keep,
    note: t.note,
    hoursPerWeek: t.hoursPerWeek,
  }));
}

function shortName(n: string): string {
  const first = n.split(/[:,.]/)[0] ?? n;
  return first.split(/\s+/).slice(0, 5).join(' ');
}

async function handIn(db: Db, h: HumanSession, task: typeof tasks.$inferSelect) {
  const name = shortName(task.name);
  const [wf] = await db
    .insert(workflows)
    .values({
      workspaceId: h.workspaceId,
      key: `wf-${crypto.randomUUID().slice(0, 8)}`,
      name,
      whenText: 'When this comes up on one of your deals',
      doesText: `Drafts it privately: ${task.name.charAt(0).toLowerCase()}${task.name.slice(1)}. Nothing is sent while it practices.`,
      trustLevel: 'practice',
      appKeys: [],
    })
    .returning({ id: workflows.id });
  await db.update(tasks).set({ workflowId: wf!.id }).where(and(eq(tasks.id, task.id), eq(tasks.workspaceId, h.workspaceId)));
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'task.handed', subjectType: 'task', subjectId: task.id, data: { workflowId: wf!.id } });
  return wf!.id;
}

export async function addTask(db: Db, h: HumanSession, input: { name: string; area: string; handToIda: boolean }) {
  const [t] = await db
    .insert(tasks)
    .values({ workspaceId: h.workspaceId, name: input.name, area: input.area, ownLevel: 'yours', canHand: true, note: 'You added this' })
    .returning();
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'task.added', subjectType: 'task', subjectId: t!.id });
  const workflowId = input.handToIda ? await handIn(db, h, t!) : null;
  return { id: t!.id, workflowId };
}

export async function handTask(db: Db, h: HumanSession, id: string) {
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.workspaceId, h.workspaceId)));
  if (!t) throw notFound();
  if (t.workflowId) throw conflict('Ida already has this task.');
  if (t.keep || !t.canHand) throw conflict('This task stays with you.');
  return { id, workflowId: await handIn(db, h, t) };
}
