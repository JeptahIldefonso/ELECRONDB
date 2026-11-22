-- ========================================================================
-- Migration 24 Down: Drop audit_log performance indexes (Stage 3)
-- ========================================================================

DROP INDEX IF EXISTS public.idx_audit_log_action_at_id_desc;
DROP INDEX IF EXISTS public.idx_audit_log_table_action_at_desc;
DROP INDEX IF EXISTS public.idx_audit_log_action;
DROP INDEX IF EXISTS public.idx_audit_log_action_by;
