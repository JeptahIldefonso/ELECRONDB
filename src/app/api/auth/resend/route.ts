import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { ok: false, code: 'invalid_email', message: 'Enter your email.' },
      { status: 400 }
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
  });

  if (error?.code === 'over_email_send_rate_limit') {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: 'Please wait a minute before requesting another email.',
      },
      { status: 429 }
    );
  }

  if (error) {
    return NextResponse.json(
      { ok: false, code: error.code ?? 'resend_failed', message: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'If that email is waiting for verification, a new link was sent.',
  });
}
