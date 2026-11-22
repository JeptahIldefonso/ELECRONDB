-- ========================================================================
-- Migration 23 Down: Rollback audit logging trigger for app_users (Stage 2)
-- ========================================================================

DROP TRIGGER IF EXISTS app_users_aiu_audit ON public.app_users;
DROP FUNCTION IF EXISTS public.trg_audit_app_users();
