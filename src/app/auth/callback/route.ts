import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureAuthDb, getStampString } from '@/lib/auth-db';
import { getHopeDb } from '@/lib/hope-db';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      try {
        await ensureAuthDb();
        const db = getHopeDb();
        const userEmail = data.user.email?.toLowerCase();

        if (userEmail) {
          const stamp = getStampString('VERIFIED', 'system');
          await db.run(
            `UPDATE USERS SET status = 'Active', stamp = ? WHERE LOWER(email) = ?`,
            [stamp, userEmail]
          );
        }
      } catch (dbErr) {
        console.warn('[auth/callback] Note: Failed to update local USERS status:', dbErr);
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    console.error('[auth/callback] Exchange code error:', error?.message);
    return NextResponse.redirect(
      `${origin}/login?error=Verification+link+is+invalid+or+has+expired.`
    );
  }

  // If visited without code, redirect back to login
  return NextResponse.redirect(`${origin}/login`);
}
