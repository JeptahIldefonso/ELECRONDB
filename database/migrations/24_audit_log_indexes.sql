-- ========================================================================
-- Migration 24: Query performance indexes on audit_log (Stage 3: S4-DBA-04)
-- Description: Adds indexes on action_at, table_name, action, and action_by
--              to ensure rapid filtering and keyset pagination in /audit.
-- ========================================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_action_at_id_desc
    ON public.audit_log (action_at DESC, audit_id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_action_at_desc
    ON public.audit_log (table_name, action_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON public.audit_log (action);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_by
    ON public.audit_log (action_by);
