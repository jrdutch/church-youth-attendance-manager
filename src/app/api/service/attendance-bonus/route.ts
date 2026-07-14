import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getAttendanceBonusCandidates, logServiceEntry, getAllServiceEventTypes,
  addAuditLog, getStudentById,
} from '@/lib/db';

const BONUS_EVENT = '90%+ Youth Group Attendance';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getAttendanceBonusCandidates(16));
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { student_id } = await req.json();
  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

  // Guard: only award to students the detection currently flags as eligible & unawarded
  const candidate = getAttendanceBonusCandidates(16).find(
    c => c.student_id === Number(student_id) && !c.already_awarded
  );
  if (!candidate) {
    return NextResponse.json({ error: 'Student is not currently eligible (or already awarded this year)' }, { status: 400 });
  }

  const eventType = getAllServiceEventTypes().find(e => e.name === BONUS_EVENT);
  const id = logServiceEntry({
    student_id: Number(student_id),
    event_type_id: eventType?.id,
    event_name: BONUS_EVENT,
    date: new Date().toISOString().split('T')[0],
    base_points: eventType?.base_points ?? 20,
    notes: `Auto-detected: attended ${candidate.attended} of ${candidate.sessions} sessions (${Math.round(candidate.rate * 100)}%)`,
    logged_by_id: session.userId,
    logged_by_name: session.name,
  });

  const student = getStudentById(Number(student_id));
  addAuditLog(session.userId, session.name, 'service_logged', 'student', Number(student_id),
    `${BONUS_EVENT} (20 pts) awarded to ${student?.first_name} ${student?.last_name}`);

  return NextResponse.json({ ok: true, id });
}
