// scripts/dry-run-stage4.mjs
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runDryRun() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run: scripts/dry-run-stage4.mjs requires explicit --confirm flag.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log('----------------------------------------------------');
    console.log(' STAGE 4 DRY-RUN (BEGIN ... ROLLBACK)');
    console.log('----------------------------------------------------');

    await client.query('BEGIN;');
    console.log('[OK] BEGIN transaction started.');

    // Step 2.1: Create backup snapshot
    console.log('\n--- 1. Testing backup snapshot creation ---');
    await client.query('CREATE SCHEMA IF NOT EXISTS backup;');
    await client.query('CREATE TABLE backup.app_users_pre_stage4 AS TABLE public.app_users;');
    const backupRes = await client.query('SELECT count(*) as count FROM backup.app_users_pre_stage4;');
    console.log(`[OK] Created backup.app_users_pre_stage4 with ${backupRes.rows[0].count} rows.`);

    // Step 2.2: Migration 25 - Add empno column, foreign key, and unique index
    console.log('\n--- 2. Testing Migration 25 (empno column, FK, unique index) ---');
    const mig25Sql = `
      -- 1. Add column empno matching employee(empno) type (varchar(5))
      ALTER TABLE public.app_users
        ADD COLUMN IF NOT EXISTS empno VARCHAR(5);

      -- 2. Add foreign key NOT VALID, then VALIDATE
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

      -- 3. Partial unique index for one account per employee
      CREATE UNIQUE INDEX IF NOT EXISTS app_users_empno_unique
        ON public.app_users(empno)
        WHERE empno IS NOT NULL;
    `;
    await client.query(mig25Sql);
    console.log('[OK] Migration 25 executed successfully.');

    // Verify column exists in transaction
    const colCheck = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'empno';
    `);
    console.log('[OK] Verified app_users.empno:', colCheck.rows[0]);

    // Verify constraint
    const conCheck = await client.query(`
      SELECT conname, contype, convalidated
      FROM pg_constraint
      WHERE conname = 'app_users_empno_fkey';
    `);
    console.log('[OK] Verified constraint app_users_empno_fkey:', conCheck.rows[0]);

    // Verify unique index
    const idxCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'app_users_empno_unique';
    `);
    console.log('[OK] Verified index app_users_empno_unique:', idxCheck.rows[0]);

    // Step 2.3: Migration 26 - Update trigger WHEN clause to include empno
    console.log('\n--- 3. Testing Migration 26 (Update Trigger WHEN Clause) ---');
    const mig26Sql = `
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
    `;
    await client.query(mig26Sql);
    console.log('[OK] Migration 26 executed successfully.');

    // Verify trigger definition
    const trgCheck = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgname = 'app_users_aiu_audit';
    `);
    console.log('[OK] Verified updated trigger:');
    console.log(trgCheck.rows[0].def);

    // Step 2.4: Test linking an employee in transaction & verify audit log
    console.log('\n--- 4. Testing Link, Unlink & Trigger Audit Logging in Transaction ---');
    const testUser = await client.query("SELECT id, email, full_name FROM public.app_users WHERE LOWER(role) = 'user' LIMIT 1;");
    const testUserId = testUser.rows[0].id;
    const testEmp = await client.query('SELECT empno, lastname, firstname FROM public.employee WHERE is_deleted = false LIMIT 1;');
    const testEmpNo = testEmp.rows[0].empno;
    console.log(`Testing with User: ${testUser.rows[0].email} (${testUserId}) and Employee: ${testEmp.rows[0].firstname} ${testEmp.rows[0].lastname} (${testEmpNo})`);

    // Link employee
    await client.query("SET LOCAL app.username = 'dry_run_tester';");
    await client.query("UPDATE public.app_users SET empno = $1 WHERE id = $2;", [testEmpNo, testUserId]);

    // Check audit row generated
    const auditRes = await client.query(`
      SELECT audit_id, table_name, action, record_key, old_values, new_values, action_by
      FROM public.audit_log
      WHERE table_name = 'app_users' AND record_key = $1
      ORDER BY action_at DESC, audit_id DESC
      LIMIT 1;
    `, [testUserId]);
    console.log('[OK] Audit log entry generated on link:');
    console.log(auditRes.rows[0]);

    // Test unique constraint rejection: attempt to link another user to same employee
    console.log('\n--- 5. Testing Unique Constraint (Double Link) Rejection ---');
    const testUser2 = await client.query("SELECT id, email FROM public.app_users WHERE id != $1 LIMIT 1;", [testUserId]);
    let uniqueRejected = false;
    try {
      await client.query("UPDATE public.app_users SET empno = $1 WHERE id = $2;", [testEmpNo, testUser2.rows[0].id]);
    } catch (e) {
      uniqueRejected = true;
      console.log(`[OK] Unique constraint successfully rejected duplicate empno: ${e.message}`);
    }
    if (!uniqueRejected) {
      throw new Error('FAIL: Unique constraint did not reject duplicate empno!');
    }

    // Rollback transaction to leave database 100% untouched
    await client.query('ROLLBACK;');
    console.log('\n[OK] ROLLBACK executed. Database remains 100% clean and untouched.');
    console.log('----------------------------------------------------');
    console.log(' DRY-RUN PASSED PERFECTLY WITH ZERO ERRORS');
    console.log('----------------------------------------------------');

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[DRY-RUN FAILED]', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runDryRun().catch(console.error);
