// src/lib/audit-types.ts
/**
 * Shared types, constants, and pure formatters for the Audit Log module.
 * Safe for use in both Server Components and Client Components.
 */

export const VALID_AUDIT_TABLES = [
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
  'app_users',
] as const;

export type ValidAuditTable = typeof VALID_AUDIT_TABLES[number];

export const VALID_AUDIT_ACTIONS = ['ADD', 'EDIT', 'DELETE', 'RESTORE'] as const;
export type ValidAuditAction = typeof VALID_AUDIT_ACTIONS[number];

export interface RightsDiffResult {
  hasChanged: boolean;
  added: string[];
  removed: string[];
  oldSorted: string[];
  newSorted: string[];
}

export interface AuditLogRecord {
  auditId: string;
  tableName: string;
  action: string;
  recordKey: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  actionBy: string;
  actionAt: string;
}

export interface AuditQueryResult {
  records: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RawAuditFilterParams {
  table?: string | null;
  action?: string | null;
  actor?: string | null;
  recordKey?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
}

export interface ValidatedAuditFilters {
  table?: string;
  action?: string;
  actor?: string;
  recordKey?: string;
  dateFrom: Date;
  dateTo: Date;
  page: number;
  pageSize: number;
}

/**
 * Formats an ISO or Date string into Asia/Manila local time.
 */
export function formatAuditTimestamp(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}
