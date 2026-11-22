-- ========================================================================
-- Migration 23: Audit logging trigger for app_users (Stage 2: S1-DEV-07)
-- Description: Adds AFTER UPDATE audit trigger on public.app_users that
--              records diffs of role, full_name, and future columns
--              (empno, status, must_change_password) into public.audit_log.
-- ========================================================================

CREATE OR REPLACE FUNCTION public.trg_audit_app_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_old jsonb := '{}'::jsonb;
    v_new jsonb := '{}'::jsonb;
    v_actor text;
BEGIN
    -- Determine actor: app.username -> app.actor_id -> auth jwt email -> session_user
    v_actor := COALESCE(
        NULLIF(current_setting('app.username', true), ''),
        NULLIF(current_setting('app.actor_id', true), ''),
        NULLIF(auth.jwt() ->> 'email', ''),
        NULLIF(auth.uid()::text, ''),
        audit_user()
    );

    IF TG_OP = 'UPDATE' THEN
        -- Only record actual diffs of meaningful columns (no noise, no timestamps)
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            v_old := v_old || jsonb_build_object('role', OLD.role);
            v_new := v_new || jsonb_build_object('role', NEW.role);
        END IF;

        IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
            v_old := v_old || jsonb_build_object('full_name', OLD.full_name);
            v_new := v_new || jsonb_build_object('full_name', NEW.full_name);
        END IF;

        -- Future-proof for Stage 4 (empno)
        IF (to_jsonb(OLD) ? 'empno') AND (to_jsonb(OLD)->>'empno') IS DISTINCT FROM (to_jsonb(NEW)->>'empno') THEN
            v_old := v_old || jsonb_build_object('empno', to_jsonb(OLD)->>'empno');
            v_new := v_new || jsonb_build_object('empno', to_jsonb(NEW)->>'empno');
        END IF;

        -- Future-proof for Stage 5 (must_change_password)
        IF (to_jsonb(OLD) ? 'must_change_password') AND (to_jsonb(OLD)->>'must_change_password') IS DISTINCT FROM (to_jsonb(NEW)->>'must_change_password') THEN
            v_old := v_old || jsonb_build_object('must_change_password', (to_jsonb(OLD)->>'must_change_password')::boolean);
            v_new := v_new || jsonb_build_object('must_change_password', (to_jsonb(NEW)->>'must_change_password')::boolean);
        END IF;

        -- Future-proof for Stage 6 (status)
        IF (to_jsonb(OLD) ? 'status') AND (to_jsonb(OLD)->>'status') IS DISTINCT FROM (to_jsonb(NEW)->>'status') THEN
            v_old := v_old || jsonb_build_object('status', to_jsonb(OLD)->>'status');
            v_new := v_new || jsonb_build_object('status', to_jsonb(NEW)->>'status');
        END IF;

        -- If nothing meaningful changed, do not log
        IF v_new = '{}'::jsonb THEN
            RETURN NEW;
        END IF;

        INSERT INTO public.audit_log (
            table_name,
            action,
            record_key,
            old_values,
            new_values,
            action_by,
            action_at
        ) VALUES (
            'app_users',
            'EDIT',
            NEW.id::text,
            v_old,
            v_new,
            v_actor,
            now()
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_aiu_audit ON public.app_users;
CREATE TRIGGER app_users_aiu_audit
AFTER UPDATE ON public.app_users
FOR EACH ROW
WHEN (
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.full_name IS DISTINCT FROM NEW.full_name
)
EXECUTE FUNCTION public.trg_audit_app_users();
