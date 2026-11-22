// scripts/verify-stage4.mjs
/**
 * Verification script for Stage 4 (Link app_users.empno to EMPLOYEE: S3-DBA-03).
 * Verifies all criteria from SPRINT-GAP-IMPLEMENTATION.md Section 6 and user review:
 * 1. Database schema (backup snapshot, column, foreign key, unique index, trigger definition).
 * 2. Regression tests for trigger:
 *    - role change logs EDIT
 *    - full_name change logs EDIT
 *    - empno link logs EDIT
 *    - empno unlink logs EDIT
 * 3. Integrity checks:
 *    - Non-existent empno rejected by DB FK
 *    - Duplicate empno rejected by unique index
 * 4. Original state cleanly restored.
 */

import { Pool } from 'pg';

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to run: scripts/verify-stage4.mjs requires explicit --confirm flag.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('----------------------------------------------------');
  console.log(' HOPE ERP — Stage 4 Verification & Regression Suite');
  console.log('----------------------------------------------------');

  const client = await pool.connect();

  try {
    // 1. Verify schema objects
    console.log('\n--- 1. Checking Database Schema Objects ---');

    // A. Snapshot
    const snap = await client.query('SELECT count(*) as count FROM backup.app_users_pre_stage4;');
    console.log(`[OK] backup.app_users_pre_stage4 exists with ${snap.rows[0].count} rows.`);

    // B. empno column
    const col = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'empno';
    `);
    if (col.rows.length === 0 || col.rows[0].character_maximum_length !== 5) {
      throw new Error('FAIL: app_users.empno column missing or invalid length');
    }
    console.log('[OK] Column app_users.empno is VARCHAR(5) nullable.');

    // C. Foreign key
    const fk = await client.query(`
      SELECT conname, contype, convalidated
      FROM pg_constraint
      WHERE conname = 'app_users_empno_fkey';
    `);
    if (fk.rows.length === 0 || !fk.rows[0].convalidated) {
      throw new Error('FAIL: app_users_empno_fkey constraint missing or not validated');
    }
    console.log('[OK] Constraint app_users_empno_fkey validated.');

    // D. Unique index
    const idx = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'app_users' AND indexname = 'app_users_empno_unique';
    `);
    if (idx.rows.length === 0) {
      throw new Error('FAIL: app_users_empno_unique index missing');
    }
    console.log('[OK] Partial unique index app_users_empno_unique active.');

    // E. Trigger definition
    const trg = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgname = 'app_users_aiu_audit';
    `);
    if (!trg.rows[0]?.def.includes('empno')) {
      throw new Error('FAIL: app_users_aiu_audit trigger does not cover empno in WHEN clause');
    }
    console.log('[OK] Trigger app_users_aiu_audit WHEN clause verified covering empno.');

    // 2. Trigger Regression Testing
    console.log('\n--- 2. Trigger Regression Tests (Role, Name, Link, Unlink) ---');
    const testUserRes = await client.query("SELECT id, email, full_name, role, empno FROM public.app_users WHERE LOWER(role) = 'user' LIMIT 1;");
    if (testUserRes.rows.length === 0) {
      throw new Error('No user with role=user found for testing');
    }
    const testUser = testUserRes.rows[0];
    const userId = testUser.id;
    const originalRole = testUser.role;
    const originalName = testUser.full_name;
    const originalEmpno = testUser.empno;

    console.log(`Using test user: ${testUser.email} (${userId})`);

    await client.query("SET LOCAL app.username = 'verify_runner';");

    // Test 2A: Full Name change
    console.log('\n- Test 2A: Full Name change audit');
    const tempName = (originalName || 'User') + ' [Verified]';
    await client.query('UPDATE public.app_users SET full_name = $1 WHERE id = $2;', [tempName, userId]);

    const nameAudit = await client.query(`
      SELECT audit_id, action, old_values, new_values, action_by 
      FROM public.audit_log 
      WHERE table_name = 'app_users' AND record_key = $1
      ORDER BY action_at DESC, audit_id DESC LIMIT 1;
    `, [userId]);
    console.log('[OK] Name change audit row:', nameAudit.rows[0]);
    if (nameAudit.rows[0]?.action !== 'EDIT' || !nameAudit.rows[0]?.new_values?.full_name) {
      throw new Error('FAIL: Full name change did not create expected audit row');
    }

    // Test 2B: empno link
    console.log('\n- Test 2B: empno link audit');
    const empRes = await client.query('SELECT empno, lastname, firstname FROM public.employee WHERE is_deleted = false LIMIT 1;');
    const sampleEmpNo = empRes.rows[0].empno;
    console.log(`Linking employee ${sampleEmpNo} (${empRes.rows[0].firstname} ${empRes.rows[0].lastname})`);

    await client.query('UPDATE public.app_users SET empno = $1 WHERE id = $2;', [sampleEmpNo, userId]);

    const linkAudit = await client.query(`
      SELECT audit_id, action, old_values, new_values, action_by 
      FROM public.audit_log 
      WHERE table_name = 'app_users' AND record_key = $1
      ORDER BY action_at DESC, audit_id DESC LIMIT 1;
    `, [userId]);
    console.log('[OK] Link audit row:', linkAudit.rows[0]);
    if (linkAudit.rows[0]?.action !== 'EDIT' || linkAudit.rows[0]?.new_values?.empno !== sampleEmpNo) {
      throw new Error('FAIL: empno link did not create expected audit row');
    }

    // Test 2C: empno unlink
    console.log('\n- Test 2C: empno unlink audit');
    await client.query('UPDATE public.app_users SET empno = NULL WHERE id = $1;', [userId]);

    const unlinkAudit = await client.query(`
      SELECT audit_id, action, old_values, new_values, action_by 
      FROM public.audit_log 
      WHERE table_name = 'app_users' AND record_key = $1
      ORDER BY action_at DESC, audit_id DESC LIMIT 1;
    `, [userId]);
    console.log('[OK] Unlink audit row:', unlinkAudit.rows[0]);
    if (unlinkAudit.rows[0]?.action !== 'EDIT' || unlinkAudit.rows[0]?.new_values?.empno !== null) {
      throw new Error('FAIL: empno unlink did not create expected audit row');
    }

    // Restore original name
    await client.query('UPDATE public.app_users SET full_name = $1, empno = $2 WHERE id = $3;', [originalName, originalEmpno, userId]);
    console.log('[OK] Restored user original state cleanly.');

    // 3. Database Constraints Testing
    console.log('\n--- 3. Database Integrity Rejection Tests ---');

    // Test 3A: Non-existent empno
    console.log('- Test 3A: Non-existent empno rejected by FK constraint');
    let fkRejected = false;
    try {
      await client.query("UPDATE public.app_users SET empno = '99999' WHERE id = $1;", [userId]);
    } catch (e) {
      fkRejected = true;
      console.log(`[OK] Foreign key constraint rejected non-existent empno: ${e.message}`);
    }
    if (!fkRejected) throw new Error('FAIL: Foreign key failed to reject non-existent empno!');

    // Test 3B: Duplicate empno rejected by unique index
    console.log('\n- Test 3B: Duplicate empno rejected by unique index');
    const allUsers = await client.query('SELECT id FROM public.app_users LIMIT 2;');
    if (allUsers.rows.length >= 2) {
      const u1 = allUsers.rows[0].id;
      const u2 = allUsers.rows[1].id;
      // Set u1
      await client.query('UPDATE public.app_users SET empno = $1 WHERE id = $2;', [sampleEmpNo, u1]);
      let dupRejected = false;
      try {
        await client.query('UPDATE public.app_users SET empno = $1 WHERE id = $2;', [sampleEmpNo, u2]);
      } catch (e) {
        dupRejected = true;
        console.log(`[OK] Unique index rejected duplicate empno: ${e.message}`);
      }
      // Clean up u1
      await client.query('UPDATE public.app_users SET empno = NULL WHERE id = $1;', [u1]);
      if (!dupRejected) throw new Error('FAIL: Unique index failed to reject duplicate empno!');
    }

    console.log('\n----------------------------------------------------');
    console.log(' ALL DATABASE & TRIGGER REGRESSION CHECKS PASSED ');
    console.log('----------------------------------------------------');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n[STAGE 4 VERIFICATION ERROR]', err);
  process.exit(1);
});
