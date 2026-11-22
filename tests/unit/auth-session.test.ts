import { describe, it, expect } from 'vitest';
import {
  signSession,
  verifySession,
  type SessionPayload,
} from '@/lib/auth-session';

describe('Auth Session JWT / Signature (auth-session.ts)', () => {
  const samplePayload: SessionPayload = {
    userId: 'usr-test-1234',
    email: 'test@hope.local',
    sessionVersion: 1,
    exp: Date.now() + 3600 * 1000,
  };

  it('signs and verifies a valid session token payload', () => {
    const token = signSession(samplePayload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = verifySession(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(samplePayload.userId);
    expect(decoded?.email).toBe(samplePayload.email);
    expect(decoded?.sessionVersion).toBe(samplePayload.sessionVersion);
  });

  it('rejects tampered or forged tokens', () => {
    const token = signSession(samplePayload);
    const tampered = token.slice(0, -4) + 'abcd';
    const decoded = verifySession(tampered);
    expect(decoded).toBeNull();
  });

  it('rejects empty or malformed token strings', () => {
    expect(verifySession('')).toBeNull();
    expect(verifySession('not.a.valid.jwt')).toBeNull();
    expect(verifySession('invalid')).toBeNull();
  });

  it('rejects expired tokens', () => {
    const expiredPayload: SessionPayload = {
      userId: 'usr-expired',
      email: 'expired@hope.local',
      sessionVersion: 1,
      exp: Date.now() - 3600 * 1000, // expired 1 hour ago
    };
    const token = signSession(expiredPayload);
    const decoded = verifySession(token);
    expect(decoded).toBeNull();
  });
});
