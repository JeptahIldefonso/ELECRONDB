import {
  getHopeDb,
  ensureHopeDb,
  CANONICAL_ERD_TABLES,
  type HopeDatabase,
  type DbHealthReason,
} from './hope-db';

export { CANONICAL_ERD_TABLES };

export interface TableHealth {
  name: string;
  exists: boolean;
  rows: number;
}

export interface DbHealthResult {
  connected: boolean;
  status: 'connected' | 'partial' | 'disconnected';
  engine: string;
  tablesExpected: number;
  tablesFound: number;
  latencyMs: number;
  checkedAt: string;
  tables: TableHealth[];
  reason?: DbHealthReason;
  message?: string;
}

// In-memory cache to prevent database hammering (10s on success, max 2s on failure)
let cachedHealth: { result: DbHealthResult; expiresAt: number } | null = null;

/**
 * Reuses the canonical database instance used by business data layers.
 */
export function getBusinessDb(): HopeDatabase {
  return getHopeDb();
}

/**
 * Performs timed verification against hope.db/Turso/Postgres without exposing internal secrets or paths.
 */
export async function checkDatabaseHealth(forceFresh = false): Promise<DbHealthResult> {
  const now = Date.now();
  if (!forceFresh && cachedHealth && cachedHealth.expiresAt > now) {
    return cachedHealth.result;
  }

  const startTime = performance.now();
  const checkedAtTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });

  try {
    // 1. Ensure initialization is complete
    const initTimeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('Cold start initialization timeout'), { code: 'timeout' })), 8000)
    );
    await Promise.race([ensureHopeDb(), initTimeoutPromise]);

    // 2. Perform health queries (with 5s query timeout)
    const runCheck = async (): Promise<DbHealthResult> => {
      const db = getHopeDb();

      // Ping test
      await db.get('SELECT 1 as ping');
      const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

      // Discover existing tables
      let masterTables: Array<{ name: string }> = [];
      if (db.engine === 'postgres') {
        masterTables = await db.query<{ name: string }>(
          "SELECT tablename as name FROM pg_tables WHERE schemaname = 'public'"
        );
      } else {
        masterTables = await db.query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table'"
        );
      }
      const existingTableNames = new Set(masterTables.map((t) => t.name.toUpperCase()));

      // Inspect each canonical table (batched for high-speed single round-trip)
      const tables: TableHealth[] = [];
      let tablesFound = 0;

      if (db.engine === 'postgres') {
        try {
          const unionSql = CANONICAL_ERD_TABLES.map(
            (t) => `SELECT '${t}' as tbl, count(*)::int as cnt FROM "${t.toLowerCase()}"`
          ).join(' UNION ALL ');
          const countRows = await db.query<{ tbl: string; cnt: number }>(unionSql);
          const countMap = new Map(countRows.map((r: any) => [String(r.tbl).toUpperCase(), Number(r.cnt ?? 0)]));
          for (const tableName of CANONICAL_ERD_TABLES) {
            const exists = countMap.has(tableName);
            if (exists) tablesFound++;
            tables.push({
              name: tableName,
              exists,
              rows: countMap.get(tableName) ?? 0,
            });
          }
        } catch {
          // fallback to individual queries if batch fails
          for (const tableName of CANONICAL_ERD_TABLES) {
            const exists = existingTableNames.has(tableName);
            let rows = 0;
            if (exists) {
              tablesFound++;
              try {
                const countRow = await db.get<{ count: number }>(`SELECT COUNT(*)::int as count FROM "${tableName.toLowerCase()}"`);
                rows = countRow?.count ?? 0;
              } catch {}
            }
            tables.push({ name: tableName, exists, rows });
          }
        }
      } else {
        await Promise.all(
          CANONICAL_ERD_TABLES.map(async (tableName) => {
            const exists = existingTableNames.has(tableName);
            let rows = 0;
            if (exists) {
              tablesFound++;
              try {
                const countRow = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM "${tableName}"`);
                rows = countRow?.count ?? 0;
              } catch {}
            }
            tables.push({ name: tableName, exists, rows });
          })
        );
      }

      const isFull = tablesFound === CANONICAL_ERD_TABLES.length;
      const isPartial = tablesFound > 0 && tablesFound < CANONICAL_ERD_TABLES.length;

      const status: 'connected' | 'partial' | 'disconnected' = isFull
        ? 'connected'
        : isPartial
        ? 'partial'
        : 'disconnected';

      let reason: DbHealthReason | undefined = undefined;
      let message = 'Database integrity verified';

      if (status === 'disconnected') {
        reason = 'table_missing';
        message = 'Database contains no tables';
      } else if (status === 'partial') {
        reason = 'table_missing';
        message = `Missing ${CANONICAL_ERD_TABLES.length - tablesFound} table(s)`;
      }

      const engineName = db.engine === 'postgres'
        ? 'Supabase PostgreSQL'
        : db.isTurso
        ? 'Turso Cloud libSQL'
        : db.isReadOnly
        ? 'SQLite (bundled read-only)'
        : 'SQLite (hope.work.db)';

      return {
        connected: status !== 'disconnected',
        status,
        engine: engineName,
        tablesExpected: CANONICAL_ERD_TABLES.length,
        tablesFound,
        latencyMs,
        checkedAt: checkedAtTime,
        tables,
        reason,
        message,
      };
    };

    const queryTimeoutPromise = new Promise<DbHealthResult>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('Health query timeout'), { code: 'timeout' })), 5000)
    );

    const result = await Promise.race([runCheck(), queryTimeoutPromise]);

    cachedHealth = {
      result,
      expiresAt: now + (result.status === 'connected' ? 10_000 : 2_000),
    };

    return result;
  } catch (err: any) {
    const rawError = err?.message || String(err);
    const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

    let reason: DbHealthReason = 'query_failed';
    let message = 'The database is currently unreachable.';

    if (err?.code === 'file_missing') {
      reason = 'file_missing';
      message = 'Bundled seed database is missing on disk.';
    } else if (err?.code === 'open_failed') {
      reason = 'open_failed';
      message = 'Failed to open local database connection.';
    } else if (err?.code === 'timeout' || rawError.includes('timeout')) {
      reason = 'timeout';
      message = 'Database query timed out.';
    } else if (rawError.includes('no such table')) {
      reason = 'table_missing';
      message = 'One or more required canonical tables are missing.';
    }

    const failedResult: DbHealthResult = {
      connected: false,
      status: 'disconnected',
      engine: 'Unknown / Unreachable',
      tablesExpected: CANONICAL_ERD_TABLES.length,
      tablesFound: 0,
      latencyMs,
      checkedAt: checkedAtTime,
      tables: CANONICAL_ERD_TABLES.map((name) => ({ name, exists: false, rows: 0 })),
      reason,
      message,
    };

    cachedHealth = {
      result: failedResult,
      expiresAt: now + 2_000,
    };

    return failedResult;
  }
}
