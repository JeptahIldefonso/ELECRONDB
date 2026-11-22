-- ========================================================================
-- Migration 23 Verification: Verify app_users audit trigger and function
-- ========================================================================

-- 1. Check trigger existence on public.app_users
SELECT 
    t.tgname AS trigger_name,
    c.relname AS table_name,
    CASE t.tgenabled
        WHEN 'O' THEN 'ENABLED'
        ELSE 'DISABLED'
    END AS status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname = 'app_users_aiu_audit';

-- 2. Check function definition
SELECT 
    p.proname AS function_name,
    p.prosecdef AS is_security_definer
FROM pg_proc p
WHERE p.proname = 'trg_audit_app_users';
