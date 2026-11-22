-- database/migrations/25_link_app_users_empno.sql
-- Stage 4: Link app_users.empno to EMPLOYEE (S3-DBA-03)
-- Additive migration: adds empno column, foreign key with ON DELETE SET NULL, and unique index.

-- 1. Add column empno matching public.employee(empno) type (VARCHAR(5))
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS empno VARCHAR(5);

-- 2. Add foreign key with ON DELETE SET NULL created NOT VALID, then VALIDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_users_empno_fkey'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_empno_fkey
      FOREIGN KEY (empno) REFERENCES public.employee(empno)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.app_users
  VALIDATE CONSTRAINT app_users_empno_fkey;

-- 3. One account per employee: partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS app_users_empno_unique
  ON public.app_users(empno)
  WHERE empno IS NOT NULL;
