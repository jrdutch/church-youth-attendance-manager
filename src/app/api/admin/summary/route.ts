import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getSummaryStatus, sendWeeklySummary } from '@/lib/summary';
import { getWeeklySummaryData, addAuditLog } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ status: getSummaryStatus(), preview: getWeeklySummaryData() });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await sendWeeklySummary();
    addAuditLog(session.userId, session.name, 'summary_sent', 'email', undefined, 'Weekly summary sent manually');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 });
  }
}
