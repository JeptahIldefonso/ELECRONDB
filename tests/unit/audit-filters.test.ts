import { describe, it, expect } from 'vitest';
import {
  validateAuditFilters,
  formatAuditTimestamp,
  VALID_AUDIT_TABLES,
  VALID_AUDIT_ACTIONS,
} from '@/lib/audit';

describe('Audit Filters Parameter Validation (validateAuditFilters)', () => {
  it('applies standard defaults when search params are empty or null', () => {
    const filters = validateAuditFilters({});

    expect(filters.table).toBeUndefined();
    expect(filters.action).toBeUndefined();
    expect(filters.actor).toBeUndefined();
    expect(filters.recordKey).toBeUndefined();
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(50);
    expect(filters.dateFrom).toBeInstanceOf(Date);
    expect(filters.dateTo).toBeInstanceOf(Date);
    expect(filters.dateTo.getTime()).toBeGreaterThan(filters.dateFrom.getTime());
  });

  it('accepts whitelisted table and action values case-insensitively', () => {
    const filters = validateAuditFilters({
      table: 'customer',
      action: 'edit',
    });

    expect(filters.table).toBe('CUSTOMER');
    expect(filters.action).toBe('EDIT');
  });

  it('safely rejects and drops SQL injection attempts in table and action', () => {
    const malicious = validateAuditFilters({
      table: "x'; DROP TABLE audit_log; --",
      action: "EDIT' OR '1'='1",
      actor: '   Attacker Name   ',
      recordKey: 'REC-1234',
    });

    // Malicious values are omitted completely
    expect(malicious.table).toBeUndefined();
    expect(malicious.action).toBeUndefined();
    expect(malicious.actor).toBe('Attacker Name');
    expect(malicious.recordKey).toBe('REC-1234');
  });

  it('handles "all" filter values by omitting column constraint', () => {
    const filters = validateAuditFilters({
      table: 'all',
      action: 'ALL',
    });

    expect(filters.table).toBeUndefined();
    expect(filters.action).toBeUndefined();
  });

  it('clamps invalid or out-of-range pagination parameters', () => {
    const negativePage = validateAuditFilters({ page: -5, pageSize: 500 });
    expect(negativePage.page).toBe(1);
    expect(negativePage.pageSize).toBe(100); // capped at max 100

    const lowPageSize = validateAuditFilters({ page: '2', pageSize: '2' });
    expect(lowPageSize.page).toBe(2);
    expect(lowPageSize.pageSize).toBe(10); // clamped to min 10
  });

  it('validates and clamps date ranges when dateFrom is after dateTo', () => {
    const inverted = validateAuditFilters({
      dateFrom: '2026-11-25',
      dateTo: '2026-11-20',
    });

    expect(inverted.dateTo.getTime()).toBeGreaterThanOrEqual(inverted.dateFrom.getTime());
  });
});

describe('Audit Timestamp Formatting (formatAuditTimestamp)', () => {
  it('formats timestamp in Asia/Manila timezone accurately', () => {
    const iso = '2026-11-22T05:24:58.542Z';
    const formatted = formatAuditTimestamp(iso);

    // 05:24 UTC = 13:24 (1:24 PM) Manila time (UTC+8)
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/Nov/i);
    expect(formatted).toContain('22');
  });

  it('handles invalid dates gracefully', () => {
    expect(formatAuditTimestamp('invalid-date')).toBe('');
  });
});
