-- ========================================================================
-- Migration 24 Verification: Verify audit_log indexes
-- ========================================================================

SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'audit_log'
ORDER BY indexname;
