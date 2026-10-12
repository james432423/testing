/**
 * The executor is the only code that sends anything. It takes an approval id,
 * not an action: no approval, no send.
 *
 * Checks, in order (each failure is audited and refused):
 *   1. approval exists in this workspace and its HMAC signature verifies;
 *   2. not used, not expired;
 *   3. the stored action re-hashes to the hash on the action row AND on the
 *      approval (detects edits after approval, including direct DB edits);
 *   4. action is in a sendable state for this approver kind;
 *   5. auto approvals: workflow is still "auto" and not paused, and the stored
 *      policy + reviewer results for this exact hash passed / approved;
 *      owner approvals: the approver is still a member of the workspace;
 *   6. atomically marks the approval used (single-use even under races),
 *      then hands off to the delivery stub and records the send.
 */
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import { actionReviews, approvals, decisions, proposedActions, workflows, workspaceMembers } from '../db/schema.ts';
import { ActionContent, contentHash } from '../gate/action.ts';
import { verifyApprovalSignature } from '../gate/approvals.ts';
import { audit } from '../audit.ts';
import { deliverStub } from './deliver-stub.ts';
import { ExecutorRefusal, type RefusalCode } from './errors.ts';

export { ExecutorRefusal, type RefusalCode } from './errors.ts';

export type ExecuteResult = { sentId: string; actionId: string };

export async function execute(db: Db, req: { workspaceId: string; approvalId: string }, now = new Date()): Promise<ExecuteResult> {
  const refuse = async (code: RefusalCode, extra: Record<string, unknown> = {}): Promise<never> => {
    await audit(db, { workspaceId: req.workspaceId, actorKind: 'executor', event: 'executor.refused', subjectType: 'approval', subjectId: req.approvalId, data: { code, ...extra } });
    throw new ExecutorRefusal(code);
  };

  const [ap] = await db.select().from(approvals).where(and(eq(approvals.id, req.approvalId), eq(approvals.workspaceId, req.workspaceId)));
  if (!ap) return refuse('approval_not_found');

  const sigOk = verifyApprovalSignature({
    id: ap.id,
    workspaceId: ap.workspaceId,
    actionId: ap.actionId,
    contentHash: ap.contentHash,
    approverKind: ap.approverKind,
    approverUserId: ap.approverUserId,
    expiresAt: ap.expiresAt,
    signature: ap.signature,
  });
  if (!sigOk) return refuse('bad_signature');
  if (ap.usedAt) return refuse('approval_used');
  if (ap.expiresAt.getTime() <= now.getTime()) return refuse('approval_expired');

  const [action] = await db.select().from(proposedActions).where(and(eq(proposedActions.id, ap.actionId), eq(proposedActions.workspaceId, req.workspaceId)));
  if (!action) return refuse('action_not_found');

  const parsed = ActionContent.safeParse(action.content);
  if (!parsed.success) return refuse('content_invalid', { actionId: action.id });
  const recomputed = contentHash({ workspaceId: action.workspaceId, workflowId: action.workflowId, dealId: action.dealId, content: parsed.data });
  if (recomputed !== action.contentHash || recomputed !== ap.contentHash) {
    return refuse('content_mismatch', { actionId: action.id });
  }

  const expectedStatus = ap.approverKind === 'auto' ? 'approved_auto' : 'awaiting_owner';
  if (action.status !== expectedStatus) return refuse('action_not_sendable', { actionId: action.id, status: action.status });

  if (ap.approverKind === 'auto') {
    const [wf] = await db.select().from(workflows).where(and(eq(workflows.id, action.workflowId), eq(workflows.workspaceId, req.workspaceId)));
    if (!wf || wf.trustLevel !== 'auto' || wf.paused) return refuse('auto_not_permitted', { reason: 'workflow' });
    const reviews = await db
      .select()
      .from(actionReviews)
      .where(and(eq(actionReviews.workspaceId, req.workspaceId), eq(actionReviews.actionId, action.id), eq(actionReviews.contentHash, recomputed)))
      .orderBy(desc(actionReviews.createdAt));
    const policy = reviews.filter((r) => r.reviewer === 'policy');
    const model = reviews.filter((r) => r.reviewer === 'model');
    const policyOk = policy.length > 0 && policy.every((r) => r.verdict === 'pass');
    const modelOk = model.length > 0 && model.every((r) => r.verdict === 'approve');
    if (!policyOk || !modelOk) return refuse('auto_not_permitted', { reason: 'reviews' });
  } else {
    if (!ap.approverUserId) return refuse('approver_not_member');
    const [m] = await db
      .select({ u: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, req.workspaceId), eq(workspaceMembers.userId, ap.approverUserId)));
    if (!m) return refuse('approver_not_member');
  }

  const content = parsed.data;
  let result: ExecuteResult | null = null;
  try {
    result = await db.transaction(async (tx) => {
      const consumed = await tx
        .update(approvals)
        .set({ usedAt: now })
        .where(and(eq(approvals.id, ap.id), isNull(approvals.usedAt), gt(approvals.expiresAt, now)))
        .returning({ id: approvals.id });
      if (consumed.length !== 1) throw new ExecutorRefusal('approval_used');

      const moved = await tx
        .update(proposedActions)
        .set({ status: 'sent', updatedAt: now })
        .where(and(eq(proposedActions.id, action.id), eq(proposedActions.workspaceId, req.workspaceId), inArray(proposedActions.status, [expectedStatus])))
        .returning({ id: proposedActions.id });
      if (moved.length !== 1) throw new ExecutorRefusal('action_not_sendable');

      const sentId = await deliverStub(tx as unknown as Db, {
        workspaceId: req.workspaceId,
        actionId: action.id,
        approvalId: ap.id,
        workflowId: action.workflowId,
        dealId: action.dealId,
        how: ap.approverKind === 'auto' ? 'auto' : 'approve',
        content,
        contentHash: recomputed,
        sentAt: now,
      });

      await tx
        .update(decisions)
        .set({ status: 'done', resolvedAt: now, resolvedBy: ap.approverUserId ?? 'auto' })
        .where(and(eq(decisions.workspaceId, req.workspaceId), eq(decisions.actionId, action.id)));

      await audit(tx as unknown as Db, {
        workspaceId: req.workspaceId,
        actorKind: 'executor',
        event: 'action.sent',
        subjectType: 'proposed_action',
        subjectId: action.id,
        data: { approvalId: ap.id, sentId, how: ap.approverKind, contentHash: recomputed, recipients: [...content.to, ...content.cc].map((r) => r.email) },
      });
      return { sentId, actionId: action.id };
    });
  } catch (e) {
    if (e instanceof ExecutorRefusal) return refuse(e.code);
    throw e;
  }
  return result;
}
