/**
 * Database schema (Drizzle ORM, Postgres).
 *
 * Tenancy: every domain table carries `workspace_id`. A workspace is the
 * tenant ("account" in product terms). We don't call the column `account_id`
 * because Auth.js already owns a table called `accounts` (linked OAuth
 * identities), and mixing the two would invite mistakes. Every query in
 * src/lib/services and src/lib/gate filters by workspace_id.
 *
 * Append-only and immutable guarantees (sent_log, audit_log, action_reviews,
 * proposed_actions.content) are enforced by triggers in the custom migration
 * drizzle/0001_guards.sql, not just by convention.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Auth.js adapter tables (shape required by @auth/drizzle-adapter)    */
/* ------------------------------------------------------------------ */

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
  image: text('image'),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    // We strip OAuth tokens before they reach the adapter (see src/auth.ts);
    // the columns exist only because the adapter's table contract requires them.
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ------------------------------------------------------------------ */
/* Tenancy                                                            */
/* ------------------------------------------------------------------ */

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerName: text('owner_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner'] }).notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    // Private beta: one workspace per user.
    uniqueIndex('workspace_members_user_unique').on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Deals, people, sources                                             */
/* ------------------------------------------------------------------ */

export const deals = pgTable(
  'deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    side: text('side').notNull(),
    statusText: text('status_text').notNull().default(''),
  },
  (t) => [uniqueIndex('deals_ws_key').on(t.workspaceId, t.key)],
);

export const dealContacts = pgTable(
  'deal_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull(),
    email: text('email').notNull(),
  },
  (t) => [index('deal_contacts_ws_deal').on(t.workspaceId, t.dealId)],
);

/** Addresses the owner allows Ida to write to even when they aren't on the deal. */
export const recipientAllowlist = pgTable(
  'recipient_allowlist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    note: text('note').notNull().default(''),
  },
  (t) => [uniqueIndex('recipient_allowlist_ws_email').on(t.workspaceId, t.email)],
);

export type SourcePage = { page: number; text: string };

/** Stored source documents. Citations are checked against `pages[].text`. */
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
    key: text('key').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    meta: text('meta').notNull().default(''),
    pageCount: integer('page_count').notNull().default(1),
    pages: jsonb('pages').$type<SourcePage[]>().notNull(),
  },
  (t) => [uniqueIndex('sources_ws_key').on(t.workspaceId, t.key)],
);

export const apps = pgTable(
  'apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    status: text('status', { enum: ['connected', 'problem', 'off'] }).notNull(),
    description: text('description').notNull().default(''),
  },
  (t) => [uniqueIndex('apps_ws_key').on(t.workspaceId, t.key)],
);

/* ------------------------------------------------------------------ */
/* Workflows, tasks, rules                                            */
/* ------------------------------------------------------------------ */

export const trustLevel = pgEnum('trust_level', ['practice', 'approve', 'auto']);

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    whenText: text('when_text').notNull(),
    doesText: text('does_text').notNull(),
    trustLevel: trustLevel('trust_level').notNull().default('practice'),
    paused: boolean('paused').notNull().default(false),
    appKeys: jsonb('app_keys').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('workflows_ws_key').on(t.workspaceId, t.key)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    area: text('area').notNull(),
    workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
    /** Level for tasks that are not tied to a workflow. */
    ownLevel: text('own_level', { enum: ['yours', 'approve', 'auto'] }).notNull().default('yours'),
    canHand: boolean('can_hand').notNull().default(false),
    keep: boolean('keep').notNull().default(false),
    note: text('note').notNull().default(''),
    hoursPerWeek: real('hours_per_week').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tasks_ws').on(t.workspaceId)],
);

export const ruleKind = pgEnum('rule_kind', ['ask_first', 'never', 'style']);

/**
 * Deterministic matcher attached to a rule. Users may only create keyword or
 * word-count matchers (no user-supplied regex, so no ReDoS). Built-ins are
 * seeded by Ida.
 */
export type RuleMatcher =
  | { type: 'keywords'; any: string[] }
  | { type: 'money' }
  | { type: 'max_words'; max: number }
  | { type: 'recipients_on_deal' };

export const rules = pgTable(
  'rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key'),
    text: text('text').notNull(),
    kind: ruleKind('kind').notNull(),
    source: text('source').notNull(),
    locked: boolean('locked').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    matchers: jsonb('matchers').$type<RuleMatcher[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rules_ws').on(t.workspaceId)],
);

/* ------------------------------------------------------------------ */
/* The action gate                                                    */
/* ------------------------------------------------------------------ */

export const actionStatus = pgEnum('action_status', [
  'pending', // stored, not yet routed
  'practice_only', // practice level: never sent
  'held', // workflow paused
  'awaiting_owner', // a decision is open for the owner
  'approved_auto', // auto level, policy + reviewer passed, approval issued
  'sent', // executor sent it
  'superseded', // owner edited it; a new version replaced it
  'dismissed', // owner said no
]);

/**
 * A proposed action. `content` is immutable after insert (DB trigger), and
 * `content_hash` is sha256 over a canonical envelope of
 * {workspaceId, workflowId, dealId, type, content}.
 */
export const proposedActions = pgTable(
  'proposed_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id').notNull().references(() => workflows.id),
    dealId: uuid('deal_id').notNull().references(() => deals.id),
    parentId: uuid('parent_id'),
    author: text('author', { enum: ['worker', 'owner'] }).notNull(),
    authorRef: text('author_ref').notNull(),
    type: text('type', { enum: ['send_email', 'send_invite'] }).notNull(),
    content: jsonb('content').notNull(),
    contentHash: text('content_hash').notNull(),
    /** The worker's own notes. Stored for debugging; never shown to the reviewer. */
    workerNotes: text('worker_notes'),
    status: actionStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('proposed_actions_ws').on(t.workspaceId, t.status)],
);

export const actionReviews = pgTable(
  'action_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => proposedActions.id),
    contentHash: text('content_hash').notNull(),
    reviewer: text('reviewer', { enum: ['policy', 'model'] }).notNull(),
    reviewerModel: text('reviewer_model'),
    verdict: text('verdict', { enum: ['pass', 'fail', 'approve', 'escalate', 'reject'] }).notNull(),
    findings: jsonb('findings').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('action_reviews_action').on(t.workspaceId, t.actionId)],
);

export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => proposedActions.id),
    workflowId: uuid('workflow_id').references(() => workflows.id),
    dealId: uuid('deal_id').references(() => deals.id),
    kind: text('kind', { enum: ['approve', 'ask', 'book'] }).notNull(),
    question: text('question').notNull(),
    primaryLabel: text('primary_label').notNull(),
    reason: text('reason').notNull().default(''),
    blockedByApp: text('blocked_by_app'),
    status: text('status', { enum: ['open', 'later', 'done', 'dismissed'] }).notNull().default('open'),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('decisions_ws_status').on(t.workspaceId, t.status)],
);

/**
 * An approval is the only thing the executor accepts. It is bound to one
 * action's content hash, HMAC-signed with APPROVAL_SIGNING_SECRET,
 * single-use (used_at) and short-lived (expires_at).
 */
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => proposedActions.id),
    contentHash: text('content_hash').notNull(),
    approverKind: text('approver_kind', { enum: ['owner', 'auto'] }).notNull(),
    approverUserId: text('approver_user_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    signature: text('signature').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('approvals_action').on(t.workspaceId, t.actionId)],
);

/** Append-only (DB trigger). Rows with origin 'executor' must carry an approval. */
export const sentLog = pgTable(
  'sent_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    origin: text('origin', { enum: ['executor', 'sample_history'] }).notNull(),
    actionId: uuid('action_id').references(() => proposedActions.id),
    approvalId: uuid('approval_id').references(() => approvals.id),
    workflowId: uuid('workflow_id').references(() => workflows.id),
    dealId: uuid('deal_id').references(() => deals.id),
    how: text('how', { enum: ['approve', 'auto'] }).notNull(),
    recipients: jsonb('recipients').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    contentHash: text('content_hash'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sent_log_ws').on(t.workspaceId, t.sentAt)],
);

/** Append-only (DB trigger). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: uuid('workspace_id'),
    actorKind: text('actor_kind', {
      enum: ['user', 'worker', 'policy', 'reviewer', 'gate', 'executor', 'system'],
    }).notNull(),
    actorId: text('actor_id'),
    event: text('event').notNull(),
    subjectType: text('subject_type'),
    subjectId: text('subject_id'),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_ws').on(t.workspaceId, t.at)],
);

/** Fixed-window rate limit counters. */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
});
