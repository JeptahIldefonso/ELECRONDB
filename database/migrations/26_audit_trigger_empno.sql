-- database/migrations/26_audit_trigger_empno.sql
-- Stage 4: Update app_users audit trigger WHEN clause to fire when empno changes

DROP TRIGGER IF EXISTS app_users_aiu_audit ON public.app_users;

CREATE TRIGGER app_users_aiu_audit
AFTER UPDATE ON public.app_users
FOR EACH ROW
WHEN (
  (OLD.role IS DISTINCT FROM NEW.role) OR
  (OLD.full_name IS DISTINCT FROM NEW.full_name) OR
  (OLD.empno IS DISTINCT FROM NEW.empno)
)
EXECUTE FUNCTION public.trg_audit_app_users();
