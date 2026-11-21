import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const username = String(body?.username ?? '').trim().slice(0, 40);
  const fullName = String(body?.fullName ?? '').trim().slice(0, 80);

  if (!EMAIL_RE.test(email)) return fail(400, 'invalid_email', 'Enter a valid email address.');
  if (password.length < 8) return fail(400, 'weak_password', 'Password must be at least 8 characters.');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: { username, full_name: fullName }, // NEVER add a role here
    },
  });

  if (error) {
    switch (error.code) {
      case 'over_email_send_rate_limit':
        return fail(429, error.code, 'Too many emails were sent. Wait a few minutes and try again.');
      case 'email_address_not_authorized':
        return fail(502, error.code, 'Email delivery is not set up for this address yet (custom SMTP missing).');
      case 'weak_password':
        return fail(400, error.code, 'That password is too weak. Use at least 8 characters.');
      case 'user_already_exists':
        return fail(409, error.code, 'This email is already registered. Try signing in.');
      default:
        return fail(400, error.code ?? 'signup_failed', error.message || 'Could not create the account. Please try again.');
    }
  }

  // F7: already-registered email returns a user with no identities and no error
  if (data.user && data.user.identities?.length === 0) {
    return fail(409, 'user_already_exists', 'This email is already registered. Try signing in.');
  }

  return NextResponse.json({ ok: true, needsVerification: true, email });
}
