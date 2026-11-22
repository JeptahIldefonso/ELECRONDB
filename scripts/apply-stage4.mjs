// scripts/apply-stage4.mjs
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to run: scripts/apply-stage4.mjs requires explicit --confirm flag.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function applyStage4() {
  const client = await pool.connect();
  try {
    console.log('----------------------------------------------------');
    console.log(' APPLYING STAGE 4 MIGRATIONS WITH COMMIT');
    console.log('----------------------------------------------------');

    await client.query('BEGIN;');
    console.log('[OK] Transaction BEGIN.');

    // 1. Create real backup snapshot
    console.log('\n--- 1. Creating backup.app_users_pre_stage4 ---');
    await client.query('CREATE SCHEMA IF NOT EXISTS backup;');
    await client.query('DROP TABLE IF EXISTS backup.app_users_pre_stage4;');
    await client.query('CREATE TABLE backup.app_users_pre_stage4 AS TABLE public.app_users;');
    console.log('[OK] Snapshot created.');

    // 2. Read and apply Migration 25
    console.log('\n--- 2. Applying Migration 25 (empno column, FK, unique index) ---');
    const mig25Path = path.resolve('database/migrations/25_link_app_users_empno.sql');
    const mig25Sql = fs.readFileSync(mig25Path, 'utf-8');
    await client.query(mig25Sql);
    console.log('[OK] Migration 25 applied.');

    // 3. Read and apply Migration 26
    console.log('\n--- 3. Applying Migration 26 (Update Trigger WHEN Clause) ---');
    const mig26Path = path.resolve('database/migrations/26_audit_trigger_empno.sql');
    const mig26Sql = fs.readFileSync(mig26Path, 'utf-8');
    await client.query(mig26Sql);
    console.log('[OK] Migration 26 applied.');

    await client.query('COMMIT;');
    console.log('\n[OK] Transaction COMMITTED successfully.');

    // 4. Verification queries
    console.log('\n--- 4. Verification Post-COMMIT ---');

    // A. Snapshot check
    const snapCheck = await client.query('SELECT count(*) as count FROM backup.app_users_pre_stage4;');
    console.log(`[VERIFY 1] backup.app_users_pre_stage4 row count: ${snapCheck.rows[0].count}`);

    // B. empno column check
    const colCheck = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'empno';
    `);
    console.log('[VERIFY 2] app_users.empno column:', colCheck.rows[0]);

    // C. Foreign key constraint check
    const conCheck = await client.query(`
      SELECT conname, contype, convalidated
      FROM pg_constraint
      WHERE conname = 'app_users_empno_fkey';
    `);
    console.log('[VERIFY 3] app_users_empno_fkey constraint:', conCheck.rows[0]);

    // D. Unique index check
    const idxCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'app_users_empno_unique';
    `);
    console.log('[VERIFY 4] app_users_empno_unique index:', idxCheck.rows[0]);

    // E. Trigger definition check
    const trgCheck = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgname = 'app_users_aiu_audit';
    `);
    console.log('[VERIFY 5] app_users_aiu_audit trigger definition:');
    console.log(trgCheck.rows[0].def);

    console.log('\n----------------------------------------------------');
    console.log(' STAGE 4 DATABASE MIGRATION COMPLETED SUCCESSFULLY ');
    console.log('----------------------------------------------------');

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[APPLY FAILED - ROLLED BACK]', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyStage4().catch(console.error);
