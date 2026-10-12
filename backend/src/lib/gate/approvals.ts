/**
 * Approvals: the only credential the executor accepts.
 *
 * An approval binds {workspace, action, content hash, approver, expiry} and
 * is signed with HMAC-SHA256 using APPROVAL_SIGNING_SECRET. Rows are
 * single-use (used_at, set atomically by the executor) and expire quickly.
 *
 * There are exactly two ways to mint one:
 *   - issueOwnerApproval: needs a HumanSession, which only the API layer can
 *     construct from an Auth.js database session (src/lib/api/session.ts).
 *   - issueAutoApproval: used by the gate for "auto" workflows, and only after
 *     the stored policy and reviewer results for this exact content hash both
 *     passed. The executor re-checks those results independently.
 * The worker module cannot import this file (enforced by a test).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { approvals, proposedActions, workspaceMembers } from '../db/schema.ts';
import { approvalSecret } from '../env.ts';
import { audit } from '../audit.ts';

export const APPROVAL_TTL_MS = 2 * 60 * 1000;

declare const humanBrand: unique symbol;
/** Proof that a request came from a signed-in person. Only src/lib/api/session.ts creates these. */
export type HumanSession = { readonly userId: string; readonly workspaceId: string; readonly [humanBrand]: true };

export type ApprovalFields = {
  id: string;
  workspaceId: string;
  actionId: string;
  contentHash: string;
  approverKind: 'owner' | 'auto';
  approverUserId: string | null;
  expiresAt: Date;
};

export function signApproval(a: ApprovalFields, secret = approvalSecret()): string {
  const payload = ['v1', a.id, a.workspaceId, a.actionId, a.contentHash, a.approverKind, a.approverUserId ?? '-', a.expiresAt.toISOString()].join('|');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyApprovalSignature(a: ApprovalFields & { signature: string }, secret = approvalSecret()): boolean {
  const expected = Buffer.from(signApproval(a, secret), 'hex');
  const given = Buffer.from(a.signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function insertApproval(db: Db, f: Omit<ApprovalFields, 'id' | 'expiresAt'>, now: Date): Promise<ApprovalFields> {
  const fields: ApprovalFields = { ...f, id: crypto.randomUUID(), expiresAt: new Date(now.getTime() + APPROVAL_TTL_MS) };
  await db.insert(approvals).values({ ...fields, signature: signApproval(fields) });
  return fields;
}

export async function issueOwnerApproval(db: Db, human: HumanSession, actionId: string, now = new Date()): Promise<ApprovalFields> {
  // Membership is re-checked here, not only in the route.
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, human.workspaceId), eq(workspaceMembers.userId, human.userId)));
  if (!member) throw new ApprovalError('not a member of this workspace');
  const [action] = await db
    .select({ id: proposedActions.id, contentHash: proposedActions.contentHash, status: proposedActions.status })
    .from(proposedActions)
    .where(and(eq(proposedActions.id, actionId), eq(proposedActions.workspaceId, human.workspaceId)));
  if (!action) throw new ApprovalError('action not found');
  if (action.status !== 'awaiting_owner') throw new ApprovalError(`action is ${action.status}`);
  const a = await insertApproval(db, { workspaceId: human.workspaceId, actionId, contentHash: action.contentHash, approverKind: 'owner', approverUserId: human.userId }, now);
  await audit(db, { workspaceId: human.workspaceId, actorKind: 'user', actorId: human.userId, event: 'approval.issued', subjectType: 'proposed_action', subjectId: actionId, data: { approvalId: a.id, kind: 'owner', contentHash: action.contentHash } });
  return a;
}

/** Gate-only. Callers must already have stored passing policy + reviewer results; the executor checks them again. */
export async function issueAutoApproval(db: Db, workspaceId: string, actionId: string, contentHash: string, now = new Date()): Promise<ApprovalFields> {
  const a = await insertApproval(db, { workspaceId, actionId, contentHash, approverKind: 'auto', approverUserId: null }, now);
  await audit(db, { workspaceId, actorKind: 'gate', event: 'approval.issued', subjectType: 'proposed_action', subjectId: actionId, data: { approvalId: a.id, kind: 'auto', contentHash } });
  return a;
}

export class ApprovalError extends Error {}
