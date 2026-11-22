-- database/migrations/25_link_app_users_empno.down.sql
-- Rollback for Stage 4: drops unique index and foreign key constraint, but keeps the column.

DROP INDEX IF EXISTS public.app_users_empno_unique;
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_empno_fkey;
