import { type EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AFTER_VERIFY = '/';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const supabase = await createClient();

  if (token_hash) {
    const otpType = (type || 'email') as EmailOtpType;
    let { error } = await supabase.auth.verifyOtp({ type: otpType, token_hash });
    if (error && otpType !== 'signup') {
      const retry = await supabase.auth.verifyOtp({ type: 'signup', token_hash });
      if (!retry.error) error = null;
    }
    if (!error) {
      if (otpType === 'recovery' || type === 'recovery') {
        redirect('/change-password?recovery=1');
      }
      redirect(`${AFTER_VERIFY}?verified=1`);
    } else {
      console.warn('[auth/confirm] verifyOtp error:', error.message, error.code);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery') {
        redirect('/change-password?recovery=1');
      }
      redirect(`${AFTER_VERIFY}?verified=1`);
    } else {
      console.warn('[auth/confirm] exchangeCode error:', error.message);
    }
  }

  redirect('/login?error=verify_failed');
}
