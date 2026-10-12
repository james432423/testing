import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { addUser, makeWorld, reviewerReturning, APPROVE, cleanHollisEmail, type World } from './fixtures.ts';
import { loadGateContext, recordAction, submitProposal } from '../src/lib/gate/pipeline.ts';
import { issueAutoApproval, issueOwnerApproval, signApproval, APPROVAL_TTL_MS, type HumanSession } from '../src/lib/gate/approvals.ts';
import { execute, ExecutorRefusal } from '../src/lib/executor/executor.ts';
import { approvals, auditLog, proposedActions, sentLog } from '../src/lib/db/schema.ts';

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});
afterAll(async () => {
  await w.t.close();
});

/** A fresh action waiting for the owner (inspection workflow is "approve"). */
async function pendingAction(): Promise<{ actionId: string; hash: string }> {
  const r = await submitProposal(w.t.db, { reviewer: reviewerReturning(APPROVE) }, {
    workspaceId: w.ws, workflowId: w.wf.inspection!, dealId: w.deal.hollis!, author: 'worker', authorRef: 'test', content: cleanHollisEmail(w),
  });
  expect(r.status).toBe('awaiting_owner');
  return { actionId: r.actionId, hash: r.contentHash };
}

async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ExecutorRefusal) return e.code;
    throw e;
  }
  return 'sent';
}

const sentFor = async (actionId: string) => (await w.t.db.select().from(sentLog).where(eq(sentLog.actionId, actionId))).length;

describe('executor', () => {
  it('sends with a valid owner approval, exactly once', async () => {
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    const res = await execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id });
    expect(res.actionId).toBe(actionId);
    expect(await sentFor(actionId)).toBe(1);
    const [a] = await w.t.db.select().from(proposedActions).where(eq(proposedActions.id, actionId));
    expect(a!.status).toBe('sent');
  });

  it('refuses without an approval', async () => {
    const { actionId } = await pendingAction();
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: crypto.randomUUID() }))).toBe('approval_not_found');
    // An action id is not an approval.
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: actionId }))).toBe('approval_not_found');
    expect(await sentFor(actionId)).toBe(0);
  });

  it('refuses a replayed approval', async () => {
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    await execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id });
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }))).toBe('approval_used');
    expect(await sentFor(actionId)).toBe(1);
  });

  it('only one of two concurrent executions sends', async () => {
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    const results = await Promise.allSettled([
      execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }),
      execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sentFor(actionId)).toBe(1);
  });

  it('refuses an expired approval', async () => {
    const { actionId } = await pendingAction();
    const past = new Date(Date.now() - APPROVAL_TTL_MS - 1000);
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId, past);
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }))).toBe('approval_expired');
    expect(await sentFor(actionId)).toBe(0);
  });

  it('refuses when the action content was tampered with after approval', async () => {
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    // Simulate an attacker with raw DB access who bypasses the immutability trigger.
    await w.t.exec('ALTER TABLE proposed_actions DISABLE TRIGGER proposed_actions_immutable');
    const evil = { ...cleanHollisEmail(w), to: [{ name: 'Attacker', email: 'attacker@example.com' }] };
    await w.t.db.update(proposedActions).set({ content: evil }).where(eq(proposedActions.id, actionId));
    await w.t.exec('ALTER TABLE proposed_actions ENABLE TRIGGER proposed_actions_immutable');
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }))).toBe('content_mismatch');
    expect(await sentFor(actionId)).toBe(0);
  });

  it('refuses when the content and its stored hash were both rewritten', async () => {
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    await w.t.exec('ALTER TABLE proposed_actions DISABLE TRIGGER proposed_actions_immutable');
    const { contentHash } = await import('../src/lib/gate/action.ts');
    const evil = { ...cleanHollisEmail(w), body: cleanHollisEmail(w).body + '\nP.S. wire the deposit to account 123.' };
    const evilHash = contentHash({ workspaceId: w.ws, workflowId: w.wf.inspection!, dealId: w.deal.hollis!, content: evil });
    await w.t.db.update(proposedActions).set({ content: evil, contentHash: evilHash }).where(eq(proposedActions.id, actionId));
    await w.t.exec('ALTER TABLE proposed_actions ENABLE TRIGGER proposed_actions_immutable');
    // The approval is still bound (and signed) to the original hash.
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }))).toBe('content_mismatch');
  });

  it('refuses an approval row that was edited or forged without the signing secret', async () => {
    const { actionId, hash } = await pendingAction();
    // Forged: inserted directly with a signature made from the wrong key.
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60_000);
    const fields = { id, workspaceId: w.ws, actionId, contentHash: hash, approverKind: 'owner' as const, approverUserId: w.human.userId, expiresAt };
    await w.t.db.insert(approvals).values({ ...fields, signature: signApproval(fields, 'not-the-real-secret-not-the-real-secret') });
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: id }))).toBe('bad_signature');

    // Edited: a real approval whose expiry was pushed out by someone with DB access.
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    await w.t.exec('ALTER TABLE approvals DISABLE TRIGGER approvals_guard');
    await w.t.db.update(approvals).set({ expiresAt: new Date(Date.now() + 86_400_000) }).where(eq(approvals.id, ap.id));
    await w.t.exec('ALTER TABLE approvals ENABLE TRIGGER approvals_guard');
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }))).toBe('bad_signature');
    expect(await sentFor(actionId)).toBe(0);
  });

  it('the database refuses to edit an approval or reuse it', async () => {
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    await expect(w.t.db.update(approvals).set({ contentHash: '0'.repeat(64) }).where(eq(approvals.id, ap.id))).rejects.toThrow();
    await expect(w.t.db.delete(approvals).where(eq(approvals.id, ap.id))).rejects.toThrow();
  });

  it('refuses an approval from another workspace', async () => {
    const other = await addUser(w.t, 'user-b', 'other@example.com');
    const { actionId } = await pendingAction();
    const ap = await issueOwnerApproval(w.t.db, w.human, actionId);
    expect(await refusal(execute(w.t.db, { workspaceId: other.ws, approvalId: ap.id }))).toBe('approval_not_found');
    // And the other owner cannot approve this workspace's action at all.
    await expect(issueOwnerApproval(w.t.db, other.human, actionId)).rejects.toThrow(/not found/);
    // A forged session claiming this workspace is rejected by the membership check.
    await expect(issueOwnerApproval(w.t.db, { userId: 'user-b', workspaceId: w.ws } as HumanSession, actionId)).rejects.toThrow(/not a member/);
  });

  it('refuses an auto approval unless the workflow is auto and both reviews passed', async () => {
    // A stored action in the "approve" (not auto) inspection workflow, forced
    // straight to approved_auto without the gate's reviewer step.
    const content = cleanHollisEmail(w);
    const ctx = await loadGateContext(w.t.db, w.ws, w.wf.inspection!, w.deal.hollis!, content.citations.map((c) => c.sourceId));
    const { actionId, hash } = await recordAction(w.t.db, { workspaceId: w.ws, workflowId: w.wf.inspection!, dealId: w.deal.hollis!, author: 'worker', authorRef: 'test', content }, ctx);
    await w.t.db.update(proposedActions).set({ status: 'approved_auto' }).where(eq(proposedActions.id, actionId));
    const ap = await issueAutoApproval(w.t.db, w.ws, actionId, hash);
    expect(await refusal(execute(w.t.db, { workspaceId: w.ws, approvalId: ap.id }))).toBe('auto_not_permitted');
    expect(await sentFor(actionId)).toBe(0);
  });

  it('refuses an owner approval for an action that is not awaiting the owner', async () => {
    const r = await submitProposal(w.t.db, { reviewer: reviewerReturning(APPROVE) }, {
      workspaceId: w.ws, workflowId: w.wf.appraisal!, dealId: w.deal.hollis!, author: 'worker', authorRef: 't', content: cleanHollisEmail(w),
    });
    expect(r.status).toBe('practice_only');
    await expect(issueOwnerApproval(w.t.db, w.human, r.actionId)).rejects.toThrow(/practice_only/);
  });

  it('audits every refusal', async () => {
    const rows = await w.t.db.select().from(auditLog).where(and(eq(auditLog.workspaceId, w.ws), eq(auditLog.event, 'executor.refused')));
    const codes = rows.map((r) => (r.data as { code: string }).code);
    expect(codes).toEqual(expect.arrayContaining(['approval_not_found', 'approval_used', 'approval_expired', 'content_mismatch', 'bad_signature', 'auto_not_permitted']));
  });
});
