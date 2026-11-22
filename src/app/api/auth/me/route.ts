import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  let userId: string | null = null;
  let email: string = '';

  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    if (claimsData?.claims?.sub) {
      userId = String(claimsData.claims.sub);
      email = String(claimsData.claims.email ?? '');
    }
  } catch {
    // Fallback to getUser()
  }

  if (!userId) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      userId = userData.user.id;
      email = userData.user.email ?? '';
    }
  }

  if (!userId) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  let role = 'user';
  let username = '';
  try {
    const { data: profile } = await supabase
      .from('app_users')
      .select('role, username, full_name')
      .eq('id', userId)
      .single();

    if (profile) {
      role = profile.role ?? 'user';
      username = profile.username ?? profile.full_name ?? '';
    }
  } catch {
    // Default
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      email,
      role,
      username,
    },
  });
}
