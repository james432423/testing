-- Hardening from the security review (SECURITY_REVIEW.md, F-02).

-- 1. TRUNCATE skips row triggers. 0001 blocked it for sent_log and audit_log;
--    block it for the other gate tables too.
CREATE TRIGGER action_reviews_no_truncate BEFORE TRUNCATE ON action_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER proposed_actions_no_truncate BEFORE TRUNCATE ON proposed_actions
  FOR EACH STATEMENT EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER approvals_no_truncate BEFORE TRUNCATE ON approvals
  FOR EACH STATEMENT EXECUTE FUNCTION ida_forbid_mutation();
--> statement-breakpoint

-- 2. A proposed action's status may only move forward along the gate's paths:
--      pending        -> held | practice_only | awaiting_owner | approved_auto
--      held           -> awaiting_owner | dismissed
--      awaiting_owner -> sent | superseded | dismissed
--      approved_auto  -> sent
--    practice_only, sent, superseded and dismissed are final. In particular a
--    practice draft can never become sendable, even through a buggy query.
CREATE OR REPLACE FUNCTION ida_action_status_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF (OLD.status = 'pending' AND NEW.status IN ('held', 'practice_only', 'awaiting_owner', 'approved_auto'))
     OR (OLD.status = 'held' AND NEW.status IN ('awaiting_owner', 'dismissed'))
     OR (OLD.status = 'awaiting_owner' AND NEW.status IN ('sent', 'superseded', 'dismissed'))
     OR (OLD.status = 'approved_auto' AND NEW.status = 'sent') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'proposed_actions status cannot change from % to %', OLD.status, NEW.status USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER proposed_actions_status_guard BEFORE UPDATE ON proposed_actions
  FOR EACH ROW EXECUTE FUNCTION ida_action_status_guard();
