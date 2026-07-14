import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserGroupAccess } from '@/lib/db';
import { maybeAutoBackup } from '@/lib/backup';
import { maybeSendWeeklySummary } from '@/lib/summary';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Opportunistic daily backup + weekly summary — fire and forget, never blocks the response
  void maybeAutoBackup();
  void maybeSendWeeklySummary();

  const groupAccess = session.role === 'admin' ? [] : getUserGroupAccess(session.userId);
  return NextResponse.json({ user: session, groupAccess });
}
