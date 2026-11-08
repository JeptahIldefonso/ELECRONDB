import { NextResponse } from 'next/server';
import { getHopeDb } from '@/lib/hope-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getHopeDb();
    await db.query('SELECT 1 as alive');

    return NextResponse.json({
      ok: true,
      engine: db.engine,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[keepalive] Error executing keepalive query:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'Database keepalive query failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
