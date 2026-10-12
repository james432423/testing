-- Database-level guards for the action gate. These hold even if application
-- code is buggy or a query is injected: the app's normal code paths never
-- need to update or delete these rows.

-- 1. sent_log, audit_log and action_reviews are append-only.
CREATE OR REPLACE FUNCTION ida_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER sent_log_append_only BEFORE UPDATE OR DELETE ON sent_log
  FOR EACH ROW EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER action_reviews_append_only BEFORE UPDATE OR DELETE ON action_reviews
  FOR EACH ROW EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint
-- TRUNCATE bypasses row triggers, so block it separately.
CREATE TRIGGER sent_log_no_truncate BEFORE TRUNCATE ON sent_log
  FOR EACH STATEMENT EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint

-- 2. A proposed action's content is immutable. Only status/updated_at may change.
CREATE OR REPLACE FUNCTION ida_action_content_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.workflow_id IS DISTINCT FROM OLD.workflow_id
     OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.author IS DISTINCT FROM OLD.author
     OR NEW.author_ref IS DISTINCT FROM OLD.author_ref
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'proposed_actions content is immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER proposed_actions_immutable BEFORE UPDATE ON proposed_actions
  FOR EACH ROW EXECUTE FUNCTION ida_action_content_immutable();
--> statement-breakpoint
CREATE TRIGGER proposed_actions_no_delete BEFORE DELETE ON proposed_actions
  FOR EACH ROW EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint

-- 3. Approvals: only used_at may be set, once.
CREATE OR REPLACE FUNCTION ida_approval_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'approvals cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.action_id IS DISTINCT FROM OLD.action_id
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.approver_kind IS DISTINCT FROM OLD.approver_kind
     OR NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.signature IS DISTINCT FROM OLD.signature
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR OLD.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'approvals are single-use and immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER approvals_guard BEFORE UPDATE OR DELETE ON approvals
  FOR EACH ROW EXECUTE FUNCTION ida_approval_guard();
--> statement-breakpoint

-- 4. Anything the executor sends must reference an approval.
ALTER TABLE sent_log ADD CONSTRAINT sent_log_executor_needs_approval
  CHECK (origin <> 'executor' OR (approval_id IS NOT NULL AND action_id IS NOT NULL AND content_hash IS NOT NULL));
--> statement-breakpoint
-- One send per approval, one send per action.
CREATE UNIQUE INDEX sent_log_one_per_approval ON sent_log (approval_id) WHERE approval_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX sent_log_one_per_action ON sent_log (action_id) WHERE action_id IS NOT NULL;
