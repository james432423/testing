import type { Db } from './db/index.ts';
import { auditLog } from './db/schema.ts';

export type AuditEntry = {
  workspaceId: string | null;
  actorKind: 'user' | 'worker' | 'policy' | 'reviewer' | 'gate' | 'executor' | 'system';
  actorId?: string | null;
  event: string;
  subjectType?: string;
  subjectId?: string;
  data?: Record<string, unknown>;
};

/** Append one row to audit_log. Never put secrets, tokens or full email bodies in `data`. */
export async function audit(db: Pick<Db, 'insert'>, e: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    workspaceId: e.workspaceId,
    actorKind: e.actorKind,
    actorId: e.actorId ?? null,
    event: e.event,
    subjectType: e.subjectType ?? null,
    subjectId: e.subjectId ?? null,
    data: e.data ?? {},
  });
}
