import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'hope_session';
export const SESSION_MAX_AGE = 86400 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  sessionVersion?: number;
  exp: number;
}

const FALLBACK_AUTH_SECRET = 'electrondb-hope-erd-production-session-fallback-secret-2026';

export function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  return FALLBACK_AUTH_SECRET;
}

export function signSession(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const secret = getSessionSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || !payload.exp || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
