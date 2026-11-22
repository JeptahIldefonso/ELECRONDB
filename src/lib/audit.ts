// src/lib/audit.ts
/**
 * System Audit Trail Utilities (Stage 2: S1-DEV-07)
 * Provides pure diff calculation for rights changes and structured
 * audit row creation for the append-only public.audit_log table.
 */

import { getHopeDb } from '@/lib/hope-db';

export interface RightsDiffResult {
  hasChanged: boolean;
  added: string[];
  removed: string[];
  oldSorted: string[];
  newSorted: string[];
}

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
