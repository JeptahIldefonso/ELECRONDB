import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const token = String(body?.token ?? '').trim();

  if (!email || !token) {
    return NextResponse.json(
      { ok: false, message: 'Please provide both your email and the verification code.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Try type 'email', then fallback to 'signup'
  let res = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (res.error) {
    res = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  }

  if (res.error) {
    return NextResponse.json(
      { ok: false, message: 'Invalid or expired code. Please request a new one.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, message: 'Email verified successfully.' });
}
