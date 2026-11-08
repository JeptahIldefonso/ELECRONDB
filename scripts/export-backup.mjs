import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
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

const ALL_TABLES = [
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
  'users',
  'rights',
  'userrights',
  'audit_log',
];

async function backupPostgres(databaseUrl) {
  console.log('[BACKUP] Connecting to PostgreSQL via DATABASE_URL...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const backupData = {
    exportedAt: new Date().toISOString(),
    source: 'PostgreSQL',
    tables: {},
    totalRows: 0,
  };

  const client = await pool.connect();
  try {
    for (const table of ALL_TABLES) {
      try {
        const res = await client.query(`SELECT * FROM "${table}"`);
        backupData.tables[table] = res.rows;
        backupData.totalRows += res.rows.length;
        console.log(`  ✓ Exported ${table.padEnd(14)} : ${String(res.rows.length).padStart(5)} rows`);
      } catch (err) {
        console.warn(`  - Skipped ${table.padEnd(14)} (${err.message})`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  return backupData;
}

async function backupSqlite() {
  console.log('[BACKUP] Exporting from local SQLite...');
  const workDb = path.join(rootDir, 'hope.work.db');
  const targetDb = fs.existsSync(workDb) ? workDb : path.join(rootDir, 'hope.db');

  const db = new DatabaseSync(targetDb);
  const backupData = {
    exportedAt: new Date().toISOString(),
    source: `SQLite (${path.basename(targetDb)})`,
    tables: {},
    totalRows: 0,
  };

  for (const table of ALL_TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM "${table.toUpperCase()}"`).all();
      backupData.tables[table] = rows;
      backupData.totalRows += rows.length;
      console.log(`  ✓ Exported ${table.padEnd(14)} : ${String(rows.length).padStart(5)} rows`);
    } catch {
      try {
        const rows = db.prepare(`SELECT * FROM "${table}"`).all();
        backupData.tables[table] = rows;
        backupData.totalRows += rows.length;
        console.log(`  ✓ Exported ${table.padEnd(14)} : ${String(rows.length).padStart(5)} rows`);
      } catch {
        console.warn(`  - Skipped ${table.padEnd(14)}`);
      }
    }
  }

  return backupData;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  let data;

  if (dbUrl && dbUrl.trim().length > 0) {
    data = await backupPostgres(dbUrl.trim());
  } else {
    data = await backupSqlite();
  }

  const backupDir = path.join(rootDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

  console.log('\n====================================================');
  console.log(`[BACKUP COMPLETED] Saved to: ${outPath}`);
  console.log(`Total Rows Exported: ${data.totalRows}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('[BACKUP ERROR]:', err);
  process.exit(1);
});
