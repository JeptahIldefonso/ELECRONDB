import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local if present
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const CANONICAL_TABLES = [
  'customer',
  'product',
  'pricehist',
  'employee',
  'job',
  'department',
  'jobhistory',
  'sales',
  'salesdetail',
  'payment',
];

const CANONICAL_RIGHTS = [
  { rightCode: 'add_customer', module: 'Customer', label: 'Add new customers' },
  { rightCode: 'edit_customer', module: 'Customer', label: 'Update customer details' },
  { rightCode: 'add_product', module: 'Products', label: 'Add new catalog products' },
  { rightCode: 'edit_product', module: 'Products', label: 'Update catalog products' },
  { rightCode: 'add_price', module: 'Products', label: 'Set product prices' },
  { rightCode: 'edit_price', module: 'Products', label: 'Revise product prices' },
  { rightCode: 'add_sale', module: 'Sales', label: 'Create new sales transactions' },
  { rightCode: 'edit_sale', module: 'Sales', label: 'Update sales headers' },
  { rightCode: 'view_sale_details', module: 'Sales', label: 'View line item details' },
  { rightCode: 'add_sale_detail', module: 'Sales', label: 'Add sale line items' },
  { rightCode: 'edit_sale_detail', module: 'Sales', label: 'Update sale line items' },
  { rightCode: 'add_employee', module: 'Human Resources', label: 'Add new staff members' },
  { rightCode: 'edit_employee', module: 'Human Resources', label: 'Update staff details' },
  { rightCode: 'view_job_history', module: 'Human Resources', label: 'View employee job assignments' },
  { rightCode: 'report_top_customers', module: 'Reports', label: 'Run Top Customers Report' },
  { rightCode: 'report_product_master', module: 'Reports', label: 'Run Product Master Report' },
  { rightCode: 'report_top_products', module: 'Reports', label: 'Run Top Products Report' },
  { rightCode: 'report_active_employees', module: 'Reports', label: 'Run Active Employees Report' },
  { rightCode: 'report_all_employees', module: 'Reports', label: 'Run All Employees Report' },
  { rightCode: 'report_employee_job_history', module: 'Reports', label: 'Run Job History Report' },
  { rightCode: 'report_top_sales', module: 'Reports', label: 'Run Top Sales Transactions Report' },
];

async function resetPostgres(databaseUrl) {
  console.log('[RESET] Connecting to PostgreSQL via DATABASE_URL...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    console.log('[RESET] Reading canonical Postgres seed SQL...');
    const seedPath = path.join(rootDir, 'database', 'seeds', '00_hope_postgres_seed.sql');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found at: ${seedPath}`);
    }

    const seedSql = fs.readFileSync(seedPath, 'utf8');

    console.log('[RESET] Executing canonical 10-table ERD master reset...');
    await client.query(seedSql);

    console.log('[RESET] Ensuring USERS, RIGHTS, and USERRIGHTS tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Superadmin', 'Admin', 'User')),
        isBlocked INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
        stamp TEXT NOT NULL,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        mustChangePassword INTEGER NOT NULL DEFAULT 0,
        sessionVersion INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS rights (
        rightCode TEXT PRIMARY KEY,
        module TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS userrights (
        userId TEXT NOT NULL REFERENCES users(userId) ON DELETE CASCADE,
        rightCode TEXT NOT NULL REFERENCES rights(rightCode) ON DELETE CASCADE,
        PRIMARY KEY (userId, rightCode)
      );
    `);

    // Seed canonical rights
    for (const r of CANONICAL_RIGHTS) {
      await client.query(`
        INSERT INTO rights (rightCode, module, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (rightCode) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description;
      `, [r.rightCode, r.module, r.label]);
    }

    // Provision Demo Accounts
    console.log('[RESET] Provisioning demo accounts...');
    const demoAccounts = [
      {
        userId: 'usr-superadmin',
        firstName: 'Hope',
        lastName: 'Superadmin',
        email: 'superadmin@hope.com',
        pass: 'useradmin',
        role: 'Superadmin',
        allRights: true,
      },
      {
        userId: 'usr-admin1',
        firstName: 'Admin',
        lastName: 'One',
        email: 'admin1@gmail.com',
        pass: 'useradmin',
        role: 'Admin',
        allRights: true,
      },
      {
        userId: 'usr-admin2',
        firstName: 'Admin',
        lastName: 'Two',
        email: 'admin2@gmail.com',
        pass: 'useradmin',
        role: 'Admin',
        allRights: true,
      },
      {
        userId: 'usr-user1',
        firstName: 'Standard',
        lastName: 'User',
        email: 'user1@gmail.com',
        pass: 'useruser',
        role: 'User',
        allRights: false,
      },
    ];

    for (const acc of demoAccounts) {
      const hash = bcrypt.hashSync(acc.pass, 10);
      await client.query(`
        INSERT INTO users (userId, firstName, lastName, email, passwordHash, role, isBlocked, status, stamp, mustChangePassword, sessionVersion)
        VALUES ($1, $2, $3, $4, $5, $6, 0, 'Active', 'RESET system', 0, 1)
        ON CONFLICT (userId) DO UPDATE SET
          passwordHash = EXCLUDED.passwordHash,
          isBlocked = 0,
          status = 'Active',
          role = EXCLUDED.role,
          sessionVersion = users.sessionVersion + 1;
      `, [acc.userId, acc.firstName, acc.lastName, acc.email.toLowerCase(), hash, acc.role]);

      // Assign rights
      const rightsToGrant = acc.allRights
        ? CANONICAL_RIGHTS.map((r) => r.rightCode)
        : [
            'add_customer', 'edit_customer',
            'add_product', 'edit_product',
            'add_sale', 'view_sale_details',
            'report_top_customers', 'report_product_master', 'report_top_products', 'report_top_sales',
          ];

      for (const rc of rightsToGrant) {
        await client.query(`
          INSERT INTO userrights (userId, rightCode)
          VALUES ($1, $2)
          ON CONFLICT (userId, rightCode) DO NOTHING;
        `, [acc.userId, rc]);
      }
    }

    // Parity Gate & Row Count Check
    console.log('\n====================================================');
    console.log(' HOPE, INC. ERP — CANONICAL PARITY GATE VERIFICATION');
    console.log('====================================================');

    let totalRows = 0;
    for (const table of CANONICAL_TABLES) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
      const count = res.rows[0].count;
      totalRows += count;
      console.log(`  ✓ ${table.toUpperCase().padEnd(14)} : ${String(count).padStart(5)} rows`);
    }

    const userCountRes = await client.query('SELECT COUNT(*)::int as count FROM users');
    console.log(`  ✓ USERS          : ${String(userCountRes.rows[0].count).padStart(5)} demo accounts`);

    console.log('----------------------------------------------------');
    console.log(`Total Canonical ERD Rows: ${totalRows} / 928 rows`);
    if (totalRows === 928) {
      console.log('>>> STATUS: [PASS] 100% CANONICAL PARITY CONFIRMED <<<');
    } else {
      console.warn(`>>> STATUS: [WARN] Expected 928 canonical rows, got ${totalRows} <<<`);
    }
    console.log('====================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

async function resetSqlite() {
  console.log('[RESET] Resetting local SQLite working copy...');
  const masterDb = path.join(rootDir, 'hope.db');
  const workDb = path.join(rootDir, 'hope.work.db');

  if (!fs.existsSync(masterDb)) {
    throw new Error(`Master seed not found at ${masterDb}`);
  }

  fs.copyFileSync(masterDb, workDb);
  console.log(`[RESET] Restored ${workDb} from canonical master seed.`);

  const db = new DatabaseSync(workDb);
  console.log('\n====================================================');
  console.log(' HOPE, INC. ERP — LOCAL CANONICAL VERIFICATION');
  console.log('====================================================');

  let totalRows = 0;
  for (const table of CANONICAL_TABLES) {
    const row = db.prepare(`SELECT count(*) as count FROM "${table.toUpperCase()}"`).get();
    const count = row ? row.count : 0;
    totalRows += count;
    console.log(`  ✓ ${table.toUpperCase().padEnd(14)} : ${String(count).padStart(5)} rows`);
  }

  console.log('----------------------------------------------------');
  console.log(`Total Canonical ERD Rows: ${totalRows} / 928 rows`);
  if (totalRows === 928) {
    console.log('>>> STATUS: [PASS] 100% CANONICAL PARITY CONFIRMED <<<');
  }
  console.log('====================================================\n');
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.trim().length > 0) {
    await resetPostgres(dbUrl.trim());
  } else {
    console.log('[NOTE] DATABASE_URL not found in environment or .env.local; resetting local SQLite copy.');
    await resetSqlite();
  }
}

main().catch((err) => {
  console.error('[RESET ERROR]:', err);
  process.exit(1);
});
