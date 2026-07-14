import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const students = (db.prepare('SELECT COUNT(*) as n FROM students WHERE is_active = 1').get() as { n: number }).n;
  const attendance = (db.prepare('SELECT COUNT(*) as n FROM attendance').get() as { n: number }).n;
  const users = (db.prepare('SELECT COUNT(*) as n FROM users WHERE is_active = 1').get() as { n: number }).n;

  return NextResponse.json({
    has_students: students > 0,
    has_attendance: attendance > 0,
    has_staff: users > 1, // more than just the admin account
    student_count: students,
  });
}
