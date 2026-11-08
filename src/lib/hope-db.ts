import os from 'node:os';
import { createClient, type Client as LibSqlClient } from '@libsql/client';
import { DatabaseSync } from 'node:sqlite';
import { Pool, type PoolClient } from 'pg';
import path from 'node:path';
import fs from 'node:fs';

export type { DatabaseSync, LibSqlClient };

export const CANONICAL_ERD_TABLES = [
  'CUSTOMER',
  'PRODUCT',
  'PRICEHIST',
  'EMPLOYEE',
  'JOB',
  'DEPARTMENT',
  'JOBHISTORY',
  'SALES',
  'SALESDETAIL',
  'PAYMENT',
] as const;

export type DbHealthReason =
  | 'file_missing'
  | 'open_failed'
  | 'query_failed'
  | 'timeout'
  | 'table_missing'
  | 'unauthorized';

export interface HopeDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  exec(sql: string): Promise<void>;
  batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<any[]>;
  isTurso: boolean;
  isPostgres: boolean;
  isReadOnly: boolean;
  engine: 'postgres' | 'turso' | 'sqlite-local' | 'sqlite-bundled-readonly';
  client?: LibSqlClient;
  pgPool?: Pool;
}

let syncDbInstance: DatabaseSync | null = null;
let asyncDbInstance: HopeDatabase | null = null;
let initPromise: Promise<string> | null = null;

// Global singleton for PostgreSQL pool to survive hot-reloads and warm serverless containers
declare global {
  // eslint-disable-next-line no-var
  var _hopePgPool: Pool | undefined;
}

/**
 * Returns true if PostgreSQL connection string (DATABASE_URL) is configured.
 */
export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Returns true if Turso cloud database credentials are provided via environment variables.
 */
export function isTursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

/**
 * Returns true if the environment enforces read-only mode:
 * - With PostgreSQL (DATABASE_URL): Always read-write (false).
 * - With Turso: Always read-write (false).
 * - Locally: False (always read-write via hope.work.db).
 * - On Vercel without external DB: Read-only fallback.
 */
export function isDatabaseReadOnly(): boolean {
  if (isPostgresConfigured() || isTursoConfigured()) {
    return false;
  }
  try {
    const activePath = getHopeDbPath();
    const masterPath = getMasterDbPath();
    return activePath === masterPath;
  } catch {
    return true;
  }
}

/**
 * Gets the pristine canonical master seed database path.
 */
export function getMasterDbPath(): string {
  const candidatePaths = [
    path.join(process.cwd(), 'hope.db'),
    path.resolve('hope.db'),
    path.join('/tmp', 'hope.db'),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore path access error and try next
    }
  }

  console.error('[hope-db] Master hope.db not found at any candidate path:', candidatePaths);
  throw Object.assign(new Error('Bundled database file is missing'), { code: 'file_missing' });
}

/**
 * Resolves the database path to use for local queries and transactions.
 */
export function getHopeDbPath(): string {
  if (isPostgresConfigured() || isTursoConfigured()) {
    return getMasterDbPath();
  }

  const workDir = process.env.VERCEL ? os.tmpdir() : process.cwd();
  const workPath = path.join(workDir, 'hope.work.db');

  if (!fs.existsSync(workPath)) {
    const masterPath = getMasterDbPath();
    try {
      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }
      fs.copyFileSync(masterPath, workPath);
      console.log(`[hope-db] Initialized working copy at ${workPath} from master seed.`);
    } catch (err) {
      console.error(`[hope-db] Failed to create working copy at ${workPath}:`, err);
      return masterPath;
    }
  }

  return workPath;
}

/**
 * Asynchronous initialization ensuring cold-start check completes once per instance.
 */
export async function ensureHopeDb(): Promise<string> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    return getHopeDbPath();
  })();

  return initPromise;
}

/**
 * Closes cached database handles (useful before testing, swapping files, or resetting).
 */
export function closeHopeDb(): void {
  if (syncDbInstance) {
    try {
      syncDbInstance.close();
    } catch {}
    syncDbInstance = null;
  }
  if (globalThis._hopePgPool) {
    try {
      globalThis._hopePgPool.end();
    } catch {}
    globalThis._hopePgPool = undefined;
  }
  asyncDbInstance = null;
}

/**
 * Synchronous SQLite database handle for local scripts or legacy compatibility.
 */
export function getHopeDbSync(): DatabaseSync {
  if (syncDbInstance) return syncDbInstance;

  const isReadOnly = isDatabaseReadOnly();
  const dbPath = getHopeDbPath();

  try {
    if (isReadOnly) {
      syncDbInstance = new DatabaseSync(dbPath, { readOnly: true });
    } else {
      syncDbInstance = new DatabaseSync(dbPath);
      try {
        syncDbInstance.exec('PRAGMA foreign_keys = ON;');
      } catch {}
      try {
        syncDbInstance.exec('PRAGMA journal_mode = WAL;');
      } catch {}
    }

    return syncDbInstance;
  } catch (err) {
    console.error('[hope-db] Failed to instantiate DatabaseSync:', err);
    throw Object.assign(new Error('Could not open SQLite database connection'), { code: 'open_failed' });
  }
}

/**
 * Converts positional '?' parameter markers into Postgres-style '$1, $2, ...'
 * markers, safely ignoring '?' characters inside single-quoted strings or comments.
 */
export function convertSqlPlaceholders(sql: string): string {
  let paramIndex = 1;
  let inString = false;
  let inComment = false;
  let inLineComment = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inString) {
      result += ch;
      if (ch === "'") {
        if (next === "'") {
          result += next;
          i++;
        } else {
          inString = false;
        }
      }
    } else if (inLineComment) {
      result += ch;
      if (ch === '\n') {
        inLineComment = false;
      }
    } else if (inComment) {
      result += ch;
      if (ch === '*' && next === '/') {
        result += next;
        i++;
        inComment = false;
      }
    } else {
      if (ch === "'") {
        inString = true;
        result += ch;
      } else if (ch === '-' && next === '-') {
        inLineComment = true;
        result += ch + next;
        i++;
      } else if (ch === '/' && next === '*') {
        inComment = true;
        result += ch + next;
        i++;
      } else if (ch === '?') {
        result += `$${paramIndex++}`;
      } else {
        result += ch;
      }
    }
  }

  return result;
}

/**
 * Dialect adapter for SQL queries targeting PostgreSQL.
 * Handles 'INSERT OR IGNORE INTO' -> 'INSERT INTO ... ON CONFLICT DO NOTHING'.
 */
export function adaptSqlForPostgres(sql: string): string {
  let s = sql.trim();

  // Convert INSERT OR IGNORE INTO ...
  if (/^INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(s)) {
    s = s.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\s+/i, 'INSERT INTO ');
    if (!/ON\s+CONFLICT/i.test(s)) {
      s = s.replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
    }
  }

  // Convert '= LOWER(?)' to '= ?' to avoid PostgreSQL function lower(unknown) parameter type error
  s = s.replace(/=\s*LOWER\s*\(\s*\?\s*\)/gi, '= ?');

  return convertSqlPlaceholders(s);
}

/**
 * Main unified database accessor for HopeERD.
 * - In Production with PostgreSQL (DATABASE_URL): Connects via persistent pg.Pool.
 * - In Production with Turso (TURSO_DATABASE_URL): Connects over HTTPS/WebSocket to Turso.
 * - In Local Development: Connects to local hope.work.db via @libsql/client file protocol.
 * - On Vercel fallback (missing external DB): Connects read-only to bundled seed.
 */
export function getHopeDb(): HopeDatabase {
  if (asyncDbInstance) return asyncDbInstance;

  const hasPostgres = isPostgresConfigured();
  const hasTurso = isTursoConfigured();
  const isReadOnly = isDatabaseReadOnly();

  if (hasPostgres) {
    if (!globalThis._hopePgPool) {
      const rawConnStr = process.env.DATABASE_URL!.trim();
      const connStr = rawConnStr.replace(/[?&]sslmode=[^&]+/i, '');
      globalThis._hopePgPool = new Pool({
        connectionString: connStr,
        ssl: {
          rejectUnauthorized: false,
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      globalThis._hopePgPool.on('error', (err) => {
        console.error('[hope-db] Unexpected error on idle Postgres client:', err);
      });
    }

    const pool = globalThis._hopePgPool;

    asyncDbInstance = {
      isTurso: false,
      isPostgres: true,
      isReadOnly: false,
      engine: 'postgres',
      pgPool: pool,

      async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const adapted = adaptSqlForPostgres(sql);
        const res = await pool.query(adapted, params || []);
        return res.rows as T[];
      },

      async get<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const adapted = adaptSqlForPostgres(sql);
        const res = await pool.query(adapted, params || []);
        return (res.rows[0] as T) || null;
      },

      async run(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
        const adapted = adaptSqlForPostgres(sql);
        const res = await pool.query(adapted, params || []);
        return {
          changes: res.rowCount ?? 0,
          lastInsertRowid: 0,
        };
      },

      async exec(sql: string): Promise<void> {
        await pool.query(sql);
      },

      async batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<any[]> {
        const client: PoolClient = await pool.connect();
        try {
          await client.query('BEGIN');
          const results = [];
          for (const stmt of statements) {
            if (typeof stmt === 'string') {
              results.push(await client.query(stmt));
            } else {
              const adapted = adaptSqlForPostgres(stmt.sql);
              results.push(await client.query(adapted, stmt.args || []));
            }
          }
          await client.query('COMMIT');
          return results;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    };

    return asyncDbInstance;
  }

  let client: LibSqlClient;
  let engineType: 'turso' | 'sqlite-local' | 'sqlite-bundled-readonly' = 'sqlite-local';

  if (hasTurso) {
    engineType = 'turso';
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  } else {
    const localDbPath = getHopeDbPath().replace(/\\/g, '/');
    engineType = isReadOnly ? 'sqlite-bundled-readonly' : 'sqlite-local';
    client = createClient({
      url: `file:${localDbPath}`,
    });
  }

  asyncDbInstance = {
    isTurso: hasTurso,
    isPostgres: false,
    isReadOnly,
    engine: engineType,
    client,

    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
      const res = await client.execute({ sql, args: params || [] });
      return Array.from(res.rows) as unknown as T[];
    },

    async get<T = any>(sql: string, params?: any[]): Promise<T | null> {
      const res = await client.execute({ sql, args: params || [] });
      return (res.rows[0] as unknown as T) || null;
    },

    async run(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
      const res = await client.execute({ sql, args: params || [] });
      return {
        changes: res.rowsAffected,
        lastInsertRowid: res.lastInsertRowid ? Number(res.lastInsertRowid) : 0,
      };
    },

    async exec(sql: string): Promise<void> {
      await client.executeMultiple(sql);
    },

    async batch(statements: Array<{ sql: string; args?: any[] } | string>): Promise<any[]> {
      const formatted = statements.map((s) => (typeof s === 'string' ? { sql: s, args: [] } : s));
      const res = await client.batch(formatted, 'write');
      return res;
    },
  };

  return asyncDbInstance;
}

/**
 * Sanitizes raw database and engine errors into polished, human-friendly messages.
 * Guarantees zero internal SQLite/Postgres/libSQL syntax or wording leaks into the user interface.
 */
export function sanitizeDbError(err: any, fallbackMessage = 'Unable to complete operation. Please try again.'): string {
  if (!err) return fallbackMessage;

  console.error('[Database Operation Error]:', err);

  const raw = typeof err === 'string' ? err : err?.message || '';
  const code = err?.code || '';

  // PostgreSQL constraint error codes
  if (code === '23505' || raw.includes('duplicate key value') || raw.includes('UNIQUE') || raw.includes('unique')) {
    return 'Duplicate entry: A record with this identifier already exists.';
  }

  if (code === '23503' || raw.includes('foreign key constraint') || raw.includes('FOREIGN KEY')) {
    return 'Referential error: The selected customer, employee, department, or product does not exist.';
  }

  if (code === '23514' || raw.includes('check constraint') || raw.includes('CHECK constraint')) {
    return 'Invalid data format or value exceeds allowed business limits.';
  }

  // Read-only environment guard (Vercel without Turso/Postgres or locked DB)
  if (raw.includes('readonly') || raw.includes('READONLY') || raw.includes('read-only')) {
    return 'This deployed environment is in read-only mode to protect canonical data. Writes are available in local development or with Turso/Supabase configured.';
  }

  // Access control & rights
  if (raw.toLowerCase().includes('access denied') || raw.toLowerCase().includes('missing right')) {
    return raw;
  }

  // Zod validation errors
  if (err?.name === 'ZodError' && err.errors?.[0]?.message) {
    return err.errors[0].message;
  }

  // Clean application message if safe
  const cleanMsg = raw.replace(/^(?:(?:[A-Za-z]+Error|SqliteError|\[libsql\]):\s*)/i, '').trim();
  if (
    cleanMsg &&
    !cleanMsg.toLowerCase().includes('sqlite') &&
    !cleanMsg.toLowerCase().includes('libsql') &&
    !cleanMsg.toLowerCase().includes('postgres') &&
    !cleanMsg.includes('prepare(') &&
    !cleanMsg.includes('syntax error')
  ) {
    return cleanMsg;
  }

  return fallbackMessage;
}
