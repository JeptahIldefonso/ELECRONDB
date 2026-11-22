// src/lib/audit.ts
/**
 * System Audit Trail Utilities (Stages 2 & 3: S1-DEV-07, S4-DEV-08, S4-DBA-04)
 * Provides diff calculation, parameter validation, query execution,
 * and database insertion for the system-wide /audit log viewer.
 */

import { getHopeDb } from '@/lib/hope-db';
import {
  VALID_AUDIT_TABLES,
  VALID_AUDIT_ACTIONS,
  type ValidAuditTable,
  type ValidAuditAction,
  type RightsDiffResult,
  type AuditLogRecord,
  type AuditQueryResult,
  type RawAuditFilterParams,
  type ValidatedAuditFilters,
} from './audit-types';

export {
  VALID_AUDIT_TABLES,
  VALID_AUDIT_ACTIONS,
  type ValidAuditTable,
  type ValidAuditAction,
  type RightsDiffResult,
  type AuditLogRecord,
  type AuditQueryResult,
  type RawAuditFilterParams,
  type ValidatedAuditFilters,
};

export { formatAuditTimestamp } from './audit-types';

/**
 * Computes deterministic, normalized diff between previous and proposed rights arrays.
 * Returns hasChanged: false if the contents match regardless of order or duplicate codes.
 */
export function calculateRightsDiff(
  oldRights: string[] = [],
  newRights: string[] = []
): RightsDiffResult {
  const oldSorted = Array.from(
    new Set((oldRights || []).map((r) => String(r || '').trim()).filter(Boolean))
  ).sort();

  const newSorted = Array.from(
    new Set((newRights || []).map((r) => String(r || '').trim()).filter(Boolean))
  ).sort();

  const oldSet = new Set(oldSorted);
  const newSet = new Set(newSorted);

  const added = newSorted.filter((r) => !oldSet.has(r));
  const removed = oldSorted.filter((r) => !newSet.has(r));

  const hasChanged = added.length > 0 || removed.length > 0;

  return {
    hasChanged,
    added,
    removed,
    oldSorted,
    newSorted,
  };
}

export interface AuditLogEntry {
  tableName: string;
  action: 'ADD' | 'EDIT' | 'DELETE' | 'RESTORE';
  recordKey: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  actionBy: string;
}

/**
 * Appends an entry to the append-only audit_log table.
 * Never swallows database errors silently.
 */
export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = getHopeDb();
  const oldJson = entry.oldValues ? JSON.stringify(entry.oldValues) : null;
  const newJson = entry.newValues ? JSON.stringify(entry.newValues) : null;
  const nowIso = new Date().toISOString();

  try {
    await db.run(
      `INSERT INTO audit_log (table_name, action, record_key, old_values, new_values, action_by, action_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.tableName,
        entry.action,
        entry.recordKey,
        oldJson,
        newJson,
        entry.actionBy || 'system',
        nowIso,
      ]
    );
  } catch (err: any) {
    console.error('[audit] Failed to write audit_log record:', err?.message);
    throw new Error(`Audit logging failed: ${err?.message || 'Database error'}`);
  }
}

/**
 * Validates and clamps URL search parameters for audit log queries.
 * Enforces strict whitelisting to eliminate any possibility of SQL injection.
 */
export function validateAuditFilters(raw: RawAuditFilterParams): ValidatedAuditFilters {
  // 1. Table Whitelisting
  let table: string | undefined;
  if (raw.table && typeof raw.table === 'string') {
    const rawT = raw.table.trim();
    if (rawT !== 'all' && rawT.length > 0) {
      const match = VALID_AUDIT_TABLES.find((t) => t.toLowerCase() === rawT.toLowerCase());
      if (match) {
        table = match;
      }
    }
  }

  // 2. Action Whitelisting
  let action: string | undefined;
  if (raw.action && typeof raw.action === 'string') {
    const rawA = raw.action.trim().toUpperCase();
    if (rawA !== 'ALL' && (VALID_AUDIT_ACTIONS as readonly string[]).includes(rawA)) {
      action = rawA;
    }
  }

  // 3. Actor Sanitization (clean text, max 100 chars)
  let actor: string | undefined;
  if (raw.actor && typeof raw.actor === 'string') {
    const trimmed = raw.actor.trim().slice(0, 100);
    if (trimmed.length > 0) {
      actor = trimmed;
    }
  }

  // 4. Record Key Sanitization (clean text, max 100 chars)
  let recordKey: string | undefined;
  if (raw.recordKey && typeof raw.recordKey === 'string') {
    const trimmed = raw.recordKey.trim().slice(0, 100);
    if (trimmed.length > 0) {
      recordKey = trimmed;
    }
  }

  // 5. Date Range Validation & Clamping (Default: last 7 days)
  const now = new Date();
  let dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (raw.dateTo && typeof raw.dateTo === 'string') {
    const parsed = new Date(raw.dateTo);
    if (!isNaN(parsed.getTime())) {
      dateTo = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
    }
  }

  let dateFrom = new Date(dateTo.getTime() - 7 * 24 * 60 * 60 * 1000);
  dateFrom.setHours(0, 0, 0, 0);
  if (raw.dateFrom && typeof raw.dateFrom === 'string') {
    const parsed = new Date(raw.dateFrom);
    if (!isNaN(parsed.getTime())) {
      dateFrom = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
    }
  }

  // Ensure dateFrom does not exceed dateTo
  if (dateFrom.getTime() > dateTo.getTime()) {
    dateFrom = new Date(dateTo.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateFrom.setHours(0, 0, 0, 0);
  }

  // 6. Pagination Clamping
  let page = 1;
  if (raw.page) {
    const parsed = parseInt(String(raw.page), 10);
    if (!isNaN(parsed) && parsed > 0) {
      page = parsed;
    }
  }

  let pageSize = 50; // Default: 50 per page
  if (raw.pageSize) {
    const parsed = parseInt(String(raw.pageSize), 10);
    if (!isNaN(parsed) && parsed > 0) {
      pageSize = Math.min(Math.max(parsed, 10), 100);
    }
  }

  return {
    table,
    action,
    actor,
    recordKey,
    dateFrom,
    dateTo,
    page,
    pageSize,
  };
}

/**
 * Retrieves paginated audit log rows with parameterized filters.
 * Never concatenates filter values into SQL strings.
 */
export async function getAuditLogs(filters: ValidatedAuditFilters): Promise<AuditQueryResult> {
  const db = getHopeDb();
  const whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  // Date filters
  whereClauses.push('action_at >= ?');
  params.push(filters.dateFrom.toISOString());

  whereClauses.push('action_at <= ?');
  params.push(filters.dateTo.toISOString());

  // Table filter
  if (filters.table) {
    whereClauses.push('LOWER(table_name) = LOWER(?)');
    params.push(filters.table);
  }

  // Action filter
  if (filters.action) {
    whereClauses.push('UPPER(action) = UPPER(?)');
    params.push(filters.action);
  }

  // Actor search
  if (filters.actor) {
    whereClauses.push('action_by ILIKE ?');
    params.push(`%${filters.actor}%`);
  }

  // Record Key search
  if (filters.recordKey) {
    whereClauses.push('record_key ILIKE ?');
    params.push(`%${filters.recordKey}%`);
  }

  const whereSql = whereClauses.join(' AND ');

  // 1. Get total record count
  const countSql = `SELECT count(*) as total FROM audit_log WHERE ${whereSql}`;
  const countRes = await db.get<{ total: number | string }>(countSql, params);
  const total = countRes ? parseInt(String(countRes.total), 10) : 0;

  // 2. Keyset / offset pagination
  const offset = (filters.page - 1) * filters.pageSize;
  const queryParams = [...params, filters.pageSize, offset];
  const querySql = `
    SELECT 
      audit_id as "auditId",
      table_name as "tableName",
      action,
      record_key as "recordKey",
      old_values as "oldValues",
      new_values as "newValues",
      action_by as "actionBy",
      action_at as "actionAt"
    FROM audit_log
    WHERE ${whereSql}
    ORDER BY action_at DESC, audit_id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await db.query<any>(querySql, queryParams);

  const records: AuditLogRecord[] = rows.map((r) => {
    let oldVal = r.oldValues ?? r.oldvalues ?? null;
    if (typeof oldVal === 'string') {
      try {
        oldVal = JSON.parse(oldVal);
      } catch {}
    }

    let newVal = r.newValues ?? r.newvalues ?? null;
    if (typeof newVal === 'string') {
      try {
        newVal = JSON.parse(newVal);
      } catch {}
    }

    return {
      auditId: String(r.auditId ?? r.audit_id ?? ''),
      tableName: String(r.tableName ?? r.table_name ?? ''),
      action: String(r.action ?? ''),
      recordKey: String(r.recordKey ?? r.record_key ?? ''),
      oldValues: oldVal,
      newValues: newVal,
      actionBy: String(r.actionBy ?? r.action_by ?? 'system'),
      actionAt: r.actionAt ?? r.action_at ? new Date(r.actionAt ?? r.action_at).toISOString() : '',
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return {
    records,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages,
  };
}
