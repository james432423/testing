/**
 * The action gate.
 *
 *   worker proposal
 *     -> schema check (strict) -> stored as pending, immutable, content-hashed
 *     -> deterministic policy (policy.ts)          -> action_reviews(policy)
 *     -> independent reviewer model (reviewer.ts)  -> action_reviews(model)
 *     -> trust level:
 *          paused   : held, nothing sent
 *          practice : practice_only, never sent
 *          approve  : awaiting_owner + decision
 *          auto     : policy passed AND reviewer approved -> auto approval -> executor
 *                     otherwise awaiting_owner + decision (escalated)
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.ts';
import {
  actionReviews,
  apps,
  dealContacts,
  deals,
  decisions,
  proposedActions,
  recipientAllowlist,
  rules,
  sources,
  workflows,
  workspaces,
} from '../db/schema.ts';
import { audit } from '../audit.ts';
import type { ModelClient } from '../models/client.ts';
import { ActionContent, contentHash } from './action.ts';
import { runPolicy, type PolicyResult, type PolicyRule, type PolicySource } from './policy.ts';
import { runReviewer, type ReviewerVerdict } from './reviewer.ts';
import { issueAutoApproval } from './approvals.ts';
import { execute } from '../executor/executor.ts';

export class GateError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type DecisionCopy = { kind: 'approve' | 'ask' | 'book'; question: string; primaryLabel: string };

export type SubmitRequest = {
  workspaceId: string;
  workflowId: string;
  dealId: string;
  author: 'worker' | 'owner';
  authorRef: string;
  content: unknown;
  notes?: string;
  parentId?: string;
  decision?: DecisionCopy;
};

export type SubmitResult = {
  actionId: string;
  contentHash: string;
  status: 'held' | 'practice_only' | 'awaiting_owner' | 'sent';
  decisionId?: string;
  sentId?: string;
  policy: PolicyResult;
  review?: ReviewerVerdict & { valid: boolean };
};

export type GateContext = {
  workflow: typeof workflows.$inferSelect;
  deal: typeof deals.$inferSelect;
  contactEmails: string[];
  allowlist: string[];
  rules: PolicyRule[];
  sources: PolicySource[];
  appsDown: string[];
};

/** Loads everything the checks need, all scoped to one workspace. */
export async function loadGateContext(db: Db, workspaceId: string, workflowId: string, dealId: string, citedSourceIds: string[]): Promise<GateContext> {
  const [workflow] = await db.select().from(workflows).where(and(eq(workflows.id, workflowId), eq(workflows.workspaceId, workspaceId)));
  if (!workflow) throw new GateError('workflow not found', 404);
  const [deal] = await db.select().from(deals).where(and(eq(deals.id, dealId), eq(deals.workspaceId, workspaceId)));
  if (!deal) throw new GateError('deal not found', 404);
  const contacts = await db.select({ email: dealContacts.email }).from(dealContacts).where(and(eq(dealContacts.workspaceId, workspaceId), eq(dealContacts.dealId, dealId)));
  const allow = await db.select({ email: recipientAllowlist.email }).from(recipientAllowlist).where(eq(recipientAllowlist.workspaceId, workspaceId));
  const ruleRows = await db.select().from(rules).where(eq(rules.workspaceId, workspaceId));
  const ids = [...new Set(citedSourceIds)];
  const srcRows = ids.length ? await db.select().from(sources).where(and(eq(sources.workspaceId, workspaceId), inArray(sources.id, ids))) : [];
  const appRows = workflow.appKeys.length
    ? await db.select().from(apps).where(and(eq(apps.workspaceId, workspaceId), inArray(apps.key, workflow.appKeys)))
    : [];
  return {
    workflow,
    deal,
    contactEmails: contacts.map((c) => c.email),
    allowlist: allow.map((a) => a.email),
    rules: ruleRows.map((r) => ({ id: r.id, text: r.text, kind: r.kind, enabled: r.enabled, matchers: r.matchers })),
    sources: srcRows.map((s) => ({ id: s.id, dealId: s.dealId, title: s.title, pages: s.pages })),
    appsDown: appRows.filter((a) => a.status !== 'connected').map((a) => a.key),
  };
}

export function policyFor(ctx: GateContext, content: ActionContent): PolicyResult {
  return runPolicy({
    content,
    deal: { id: ctx.deal.id, name: ctx.deal.name },
    dealContactEmails: ctx.contactEmails,
    allowlistEmails: ctx.allowlist,
    rules: ctx.rules,
    sources: ctx.sources,
  });
}

/** Stores a new immutable action version and its policy review. Shared by the gate and owner edits. */
export async function recordAction(
  db: Db,
  req: Omit<SubmitRequest, 'content' | 'decision'> & { content: ActionContent },
  ctx: GateContext,
): Promise<{ actionId: string; hash: string; policy: PolicyResult }> {
  const hash = contentHash({ workspaceId: req.workspaceId, workflowId: req.workflowId, dealId: req.dealId, content: req.content });
  const [row] = await db
    .insert(proposedActions)
    .values({
      workspaceId: req.workspaceId,
      workflowId: req.workflowId,
      dealId: req.dealId,
      parentId: req.parentId ?? null,
      author: req.author,
      authorRef: req.authorRef,
      type: req.content.type,
      content: req.content,
      contentHash: hash,
      workerNotes: req.notes ?? null,
      status: 'pending',
    })
    .returning({ id: proposedActions.id });
  const actionId = row!.id;
  await audit(db, {
    workspaceId: req.workspaceId,
    actorKind: req.author === 'worker' ? 'worker' : 'user',
    actorId: req.authorRef,
    event: 'action.proposed',
    subjectType: 'proposed_action',
    subjectId: actionId,
    data: { contentHash: hash, workflowId: req.workflowId, dealId: req.dealId, type: req.content.type, parentId: req.parentId ?? null },
  });

  const policy = policyFor(ctx, req.content);
  await db.insert(actionReviews).values({
    workspaceId: req.workspaceId,
    actionId,
    contentHash: hash,
    reviewer: 'policy',
    reviewerModel: null,
    verdict: policy.passed ? 'pass' : 'fail',
    findings: policy.findings,
  });
  await audit(db, { workspaceId: req.workspaceId, actorKind: 'policy', event: policy.passed ? 'policy.passed' : 'policy.failed', subjectType: 'proposed_action', subjectId: actionId, data: { findings: policy.findings } });
  return { actionId, hash, policy };
}

function defaultDecisionCopy(content: ActionContent): DecisionCopy {
  const names = content.to.map((r) => r.name).join(' and ');
  return content.type === 'send_invite'
    ? { kind: 'book', question: `Send the invite "${content.subject}" to ${names}?`, primaryLabel: 'Approve and send' }
    : { kind: 'approve', question: `Send "${content.subject}" to ${names}?`, primaryLabel: 'Approve and send' };
}

function escalationReason(policy: PolicyResult, review: ReviewerVerdict): string {
  const parts = policy.findings.filter((f) => f.severity !== 'warn').map((f) => f.message);
  if (review.verdict !== 'approve') parts.push(...review.reasons);
  return parts.join(' ');
}

export async function submitProposal(db: Db, deps: { reviewer: ModelClient; now?: () => Date }, req: SubmitRequest): Promise<SubmitResult> {
  const now = deps.now ?? (() => new Date());
  const parsed = ActionContent.safeParse(req.content);
  if (!parsed.success) {
    await audit(db, { workspaceId: req.workspaceId, actorKind: 'gate', event: 'action.rejected_schema', data: { issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), code: i.code })) } });
    throw new GateError('proposed action does not match the schema');
  }
  const content = parsed.data;
  const ctx = await loadGateContext(db, req.workspaceId, req.workflowId, req.dealId, content.citations.map((c) => c.sourceId));
  const { actionId, hash, policy } = await recordAction(db, { ...req, content }, ctx);

  const setStatus = (status: 'held' | 'practice_only' | 'awaiting_owner' | 'approved_auto') =>
    db.update(proposedActions).set({ status, updatedAt: now() }).where(and(eq(proposedActions.id, actionId), eq(proposedActions.workspaceId, req.workspaceId)));

  if (ctx.workflow.paused) {
    await setStatus('held');
    await audit(db, { workspaceId: req.workspaceId, actorKind: 'gate', event: 'action.held', subjectType: 'proposed_action', subjectId: actionId, data: { reason: 'workflow paused' } });
    return { actionId, contentHash: hash, status: 'held', policy };
  }

  // Independent review. The reviewer sees only the action, cited excerpts and rules.
  if (deps.reviewer.role !== 'reviewer') throw new Error('gate requires the reviewer client');
  const rv = await runReviewer(deps.reviewer, { content, sources: ctx.sources, rules: ctx.rules });
  await db.insert(actionReviews).values({
    workspaceId: req.workspaceId,
    actionId,
    contentHash: hash,
    reviewer: 'model',
    reviewerModel: rv.model,
    verdict: rv.verdict.verdict,
    findings: { reasons: rv.verdict.reasons, valid: rv.valid },
  });
  await audit(db, { workspaceId: req.workspaceId, actorKind: 'reviewer', actorId: rv.model, event: `review.${rv.verdict.verdict}`, subjectType: 'proposed_action', subjectId: actionId, data: { reasons: rv.verdict.reasons, valid: rv.valid } });
  const review = { ...rv.verdict, valid: rv.valid };

  const level = ctx.workflow.trustLevel;
  if (level === 'practice') {
    await setStatus('practice_only');
    await audit(db, { workspaceId: req.workspaceId, actorKind: 'gate', event: 'action.practice_only', subjectType: 'proposed_action', subjectId: actionId });
    return { actionId, contentHash: hash, status: 'practice_only', policy, review };
  }

  if (level === 'auto' && policy.passed && rv.verdict.verdict === 'approve' && ctx.appsDown.length === 0) {
    await setStatus('approved_auto');
    const approval = await issueAutoApproval(db, req.workspaceId, actionId, hash, now());
    const sent = await execute(db, { workspaceId: req.workspaceId, approvalId: approval.id }, now());
    return { actionId, contentHash: hash, status: 'sent', sentId: sent.sentId, policy, review };
  }

  // approve level, or auto that didn't clear every check: the owner decides.
  await setStatus('awaiting_owner');
  const copy = req.decision ?? defaultDecisionCopy(content);
  const escalated = level === 'auto';
  const [d] = await db
    .insert(decisions)
    .values({
      workspaceId: req.workspaceId,
      actionId,
      workflowId: req.workflowId,
      dealId: req.dealId,
      kind: copy.kind,
      question: copy.question,
      primaryLabel: copy.primaryLabel,
      reason: escalationReason(policy, rv.verdict),
      blockedByApp: ctx.appsDown[0] ?? null,
      status: 'open',
    })
    .returning({ id: decisions.id });
  await audit(db, { workspaceId: req.workspaceId, actorKind: 'gate', event: escalated ? 'action.escalated' : 'action.awaiting_owner', subjectType: 'proposed_action', subjectId: actionId, data: { decisionId: d!.id } });
  return { actionId, contentHash: hash, status: 'awaiting_owner', decisionId: d!.id, policy, review };
}

/** Workspace display name for drafts (used by the worker context). */
export async function workspaceOwnerName(db: Db, workspaceId: string): Promise<string> {
  const [w] = await db.select({ ownerName: workspaces.ownerName }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return w?.ownerName ?? '';
}
