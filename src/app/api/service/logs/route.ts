import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { logServiceEntry, getRecentServiceLogs, addAuditLog } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getRecentServiceLogs(100));
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { student_id, event_type_id, event_name, date, base_points,
          leadership_bonus, reflection_bonus, bonus_points, notes } = body;

  if (!student_id || !event_name || !date || base_points === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const id = logServiceEntry({
    student_id: Number(student_id),
    event_type_id: event_type_id ? Number(event_type_id) : undefined,
    event_name: String(event_name),
    date: String(date),
    base_points: Number(base_points),
    leadership_bonus: leadership_bonus ? 1 : 0,
    reflection_bonus: reflection_bonus ? 1 : 0,
    bonus_points: Number(bonus_points ?? 0),
    notes: notes || undefined,
    logged_by_id: session.userId,
    logged_by_name: session.name,
  });

  const total = Number(base_points) + (leadership_bonus ? 5 : 0) + (reflection_bonus ? 3 : 0) + Number(bonus_points ?? 0);
  addAuditLog(session.userId, session.name, 'service_logged', 'student', student_id,
    `${event_name} — ${total} pts logged for student #${student_id}`);

  return NextResponse.json({ ok: true, id });
}
