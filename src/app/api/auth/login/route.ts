import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  ensureAuthDb,
  findAccountByEmail,
  verifyPassword,
} from '@/lib/auth-db';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  signSession,
} from '@/lib/auth-session';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const identifier = String(body?.identifier ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!identifier || !password) {
    return NextResponse.json(
      { ok: false, code: 'missing_fields', message: 'Enter your email and password.' },
      { status: 400 }
    );
  }

  // Username-only accounts (admin / superadmin, see §6) map to an internal address
  const email = identifier.includes('@') ? identifier : `${identifier}@admin.local`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('not confirmed')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'email_not_confirmed',
          message: 'Please verify your email first. Check your inbox or resend the link.',
          canResend: true,
          email,
        },
        { status: 403 }
      );
    }

    // Fallback: Check local SQLite/Postgres demo accounts (e.g. superadmin@hope.com / demo)
    try {
      await ensureAuthDb();
      const localAccount = await findAccountByEmail(identifier);
      if (localAccount) {
        if (localAccount.isBlocked) {
          return NextResponse.json(
            { ok: false, code: 'blocked', message: 'Your account has been blocked by an administrator.' },
            { status: 403 }
          );
        }
        if (localAccount.status === 'Inactive') {
          return NextResponse.json(
            { ok: false, code: 'email_not_confirmed', message: 'Please verify your email first.', canResend: true, email: identifier },
            { status: 403 }
          );
        }
        const isValid = await verifyPassword(password, localAccount.passwordHash);
        if (isValid) {
          // Set legacy session cookie for seamless demo compatibility
          const sessionToken = signSession({
            userId: localAccount.userId,
            email: localAccount.email,
            sessionVersion: localAccount.sessionVersion ?? 1,
            exp: Date.now() + SESSION_MAX_AGE * 1000,
          });
          const cookieStore = await cookies();
          cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: SESSION_MAX_AGE,
            sameSite: 'lax',
          });

          return NextResponse.json({ ok: true, role: localAccount.role });
        }
      }
    } catch {
      // Ignore local lookup errors
    }

    return NextResponse.json(
      { ok: false, code: 'invalid_credentials', message: 'Wrong email/username or password.' },
      { status: 401 }
    );
  }

  // Supabase Auth succeeded
  let role = 'user';
  try {
    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    if (profile?.role) {
      role = profile.role;
    }
  } catch {
    // Default to user
  }

  return NextResponse.json({ ok: true, role });
}
