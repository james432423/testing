import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { rules, type RuleMatcher } from '../db/schema.ts';
import type { HumanSession } from '../gate/approvals.ts';
import { audit } from '../audit.ts';
import { forbidden, notFound } from '../api/errors.ts';

export async function listRules(db: Db, h: HumanSession) {
  const rows = await db.select().from(rules).where(eq(rules.workspaceId, h.workspaceId)).orderBy(asc(rules.createdAt));
  return rows.map((r) => ({ id: r.id, text: r.text, kind: r.kind, source: r.source, locked: r.locked, enabled: r.enabled, matchers: r.matchers }));
}

export async function createRule(db: Db, h: HumanSession, input: { text: string; kind: 'ask_first' | 'never' | 'style'; keywords?: string[] }) {
  const matchers: RuleMatcher[] = input.keywords?.length ? [{ type: 'keywords', any: input.keywords }] : [];
  const [r] = await db
    .insert(rules)
    .values({ workspaceId: h.workspaceId, text: input.text, kind: input.kind, source: 'You added this', matchers })
    .returning({ id: rules.id });
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'rule.created', subjectType: 'rule', subjectId: r!.id, data: { kind: input.kind } });
  return { id: r!.id };
}

async function loadEditable(db: Db, h: HumanSession, id: string) {
  const [r] = await db.select().from(rules).where(and(eq(rules.id, id), eq(rules.workspaceId, h.workspaceId)));
  if (!r) throw notFound();
  if (r.locked) throw forbidden('This rule is always on.');
  return r;
}

export async function updateRule(db: Db, h: HumanSession, id: string, patch: { text?: string; enabled?: boolean; keywords?: string[] }) {
  const before = await loadEditable(db, h, id);
  await db
    .update(rules)
    .set({
      ...(patch.text !== undefined ? { text: patch.text, source: 'You edited this' } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.keywords !== undefined ? { matchers: patch.keywords.length ? [{ type: 'keywords' as const, any: patch.keywords }] : [] } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(rules.id, id), eq(rules.workspaceId, h.workspaceId)));
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'rule.updated', subjectType: 'rule', subjectId: id, data: { from: { text: before.text, enabled: before.enabled } } });
  return { id };
}

export async function deleteRule(db: Db, h: HumanSession, id: string) {
  const before = await loadEditable(db, h, id);
  await db.delete(rules).where(and(eq(rules.id, id), eq(rules.workspaceId, h.workspaceId)));
  await audit(db, { workspaceId: h.workspaceId, actorKind: 'user', actorId: h.userId, event: 'rule.deleted', subjectType: 'rule', subjectId: id, data: { text: before.text, kind: before.kind } });
  return { id, deleted: true };
}
