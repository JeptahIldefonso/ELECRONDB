import { describe, it, expect } from 'vitest';

describe('Authentication Validation Rules', () => {
  function validateRegistration(email: string, password: string, fullName: string) {
    if (!email?.trim() || !password?.trim() || !fullName?.trim()) {
      return { valid: false, error: 'All fields are required.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { valid: false, error: 'Invalid email address format.' };
    }
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters.' };
    }
    return { valid: true };
  }

  it('accepts valid credentials with 8+ character password', () => {
    const res = validateRegistration('employee@hope.com', 'SecurePass123', 'John Doe');
    expect(res.valid).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const res = validateRegistration('employee@hope.com', 'short', 'John Doe');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Password must be at least 8 characters.');
  });

  it('rejects empty or whitespace-only fields', () => {
    expect(validateRegistration('', 'SecurePass123', 'John Doe').valid).toBe(false);
    expect(validateRegistration('user@hope.com', '', 'John Doe').valid).toBe(false);
    expect(validateRegistration('user@hope.com', 'SecurePass123', '   ').valid).toBe(false);
  });

  it('rejects malformed email formats', () => {
    expect(validateRegistration('notanemail', 'SecurePass123', 'John Doe').valid).toBe(false);
    expect(validateRegistration('@missingusername.com', 'SecurePass123', 'John Doe').valid).toBe(false);
    expect(validateRegistration('user@domain', 'SecurePass123', 'John Doe').valid).toBe(false);
  });
});
