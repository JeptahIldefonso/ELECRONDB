// src/lib/empno-validation.ts
/**
 * Pure validation helper for linking user accounts to employees (Stage 4, S3-DBA-03).
 * Testable in isolation without mocking the entire database connection.
 */

export interface EmployeeLinkValidationContext {
  employeeExists: boolean;
  isDeleted: boolean;
  alreadyLinkedToUserId?: string | null;
  currentUserId: string;
}

export interface ValidateEmpnoLinkResult {
  valid: boolean;
  normalizedEmpno: string | null;
  error?: string;
}

export function validateEmpnoLink(
  rawEmpno: string | null | undefined,
  context?: EmployeeLinkValidationContext
): ValidateEmpnoLinkResult {
  if (rawEmpno === null || rawEmpno === undefined) {
    return { valid: true, normalizedEmpno: null };
  }

  const trimmed = String(rawEmpno).trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none') {
    return { valid: true, normalizedEmpno: null };
  }

  if (trimmed.length > 5) {
    return {
      valid: false,
      normalizedEmpno: null,
      error: 'Employee number must not exceed 5 characters.',
    };
  }

  if (!context) {
    return { valid: true, normalizedEmpno: trimmed };
  }

  if (!context.employeeExists) {
    return {
      valid: false,
      normalizedEmpno: null,
      error: 'Employee not found.',
    };
  }

  if (context.isDeleted) {
    return {
      valid: false,
      normalizedEmpno: null,
      error: 'Cannot link to a deleted employee profile.',
    };
  }

  if (context.alreadyLinkedToUserId && context.alreadyLinkedToUserId !== context.currentUserId) {
    return {
      valid: false,
      normalizedEmpno: null,
      error: 'Employee already linked to another account.',
    };
  }

  return { valid: true, normalizedEmpno: trimmed };
}
