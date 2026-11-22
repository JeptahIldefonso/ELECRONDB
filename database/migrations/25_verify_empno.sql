-- database/migrations/25_verify_empno.sql
-- Verification query for Stage 4

-- 1. Check empno column in app_users
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'empno';

-- 2. Check foreign key constraint
SELECT conname, contype, convalidated
FROM pg_constraint
WHERE conname = 'app_users_empno_fkey';

-- 3. Check partial unique index
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'app_users_empno_unique';

-- 4. Check trigger definition
SELECT tgname, pg_get_triggerdef(oid) as def
FROM pg_trigger
WHERE tgname = 'app_users_aiu_audit';
