-- database/migrations/26_audit_trigger_empno.down.sql
-- Revert trigger WHEN clause back to Stage 2 definition (role and full_name only)

DROP TRIGGER IF EXISTS app_users_aiu_audit ON public.app_users;

CREATE TRIGGER app_users_aiu_audit
AFTER UPDATE ON public.app_users
FOR EACH ROW
WHEN (
  (OLD.role IS DISTINCT FROM NEW.role) OR
  (OLD.full_name IS DISTINCT FROM NEW.full_name)
)
EXECUTE FUNCTION public.trg_audit_app_users();
