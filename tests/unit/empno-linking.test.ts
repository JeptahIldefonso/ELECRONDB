// tests/unit/empno-linking.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmpnoLink } from '../../src/lib/empno-validation';

describe('Stage 4: Employee Linking Validation Logic (S3-DBA-03)', () => {
  it('allows unlinking when empno is null', () => {
    const result = validateEmpnoLink(null);
    expect(result.valid).toBe(true);
    expect(result.normalizedEmpno).toBeNull();
  });

  it('allows unlinking when empno is empty string or "none"', () => {
    const r1 = validateEmpnoLink('');
    expect(r1.valid).toBe(true);
    expect(r1.normalizedEmpno).toBeNull();

    const r2 = validateEmpnoLink('  ');
    expect(r2.valid).toBe(true);
    expect(r2.normalizedEmpno).toBeNull();

    const r3 = validateEmpnoLink('none');
    expect(r3.valid).toBe(true);
    expect(r3.normalizedEmpno).toBeNull();
  });

  it('rejects employee number exceeding 5 characters', () => {
    const result = validateEmpnoLink('123456');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must not exceed 5 characters');
  });

  it('rejects nonexistent employee', () => {
    const result = validateEmpnoLink('99999', {
      employeeExists: false,
      isDeleted: false,
      alreadyLinkedToUserId: null,
      currentUserId: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Employee not found.');
  });

  it('rejects soft-deleted employee', () => {
    const result = validateEmpnoLink('00001', {
      employeeExists: true,
      isDeleted: true,
      alreadyLinkedToUserId: null,
      currentUserId: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Cannot link to a deleted employee profile.');
  });

  it('rejects linking employee already linked to another account', () => {
    const result = validateEmpnoLink('00001', {
      employeeExists: true,
      isDeleted: false,
      alreadyLinkedToUserId: 'user-2',
      currentUserId: 'user-1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Employee already linked to another account.');
  });

  it('permits linking employee when already linked to the SAME account (idempotent)', () => {
    const result = validateEmpnoLink('00001', {
      employeeExists: true,
      isDeleted: false,
      alreadyLinkedToUserId: 'user-1',
      currentUserId: 'user-1',
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedEmpno).toBe('00001');
  });

  it('permits linking an available, active employee', () => {
    const result = validateEmpnoLink(' 00005 ', {
      employeeExists: true,
      isDeleted: false,
      alreadyLinkedToUserId: null,
      currentUserId: 'user-1',
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedEmpno).toBe('00005');
  });
});
