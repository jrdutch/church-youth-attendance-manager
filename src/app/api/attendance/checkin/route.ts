import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { checkInStudent, isCheckedIn, getStudentById, userGroupPermissions, getMedicalInfo, addAuditLog } from '@/lib/db';
import { format } from 'date-fns';

// Kiosk medical preview: GET /api/attendance/checkin?student_id=X&kiosk_preview=1
// Returns medical alert info without checking in (no auth required for kiosk)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kioskPreview = searchParams.get('kiosk_preview') === '1';
  const studentId = searchParams.get('student_id');

  if (!kioskPreview || !studentId) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const student = getStudentById(Number(studentId));
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const medical = getMedicalInfo(Number(studentId));
  const hasAlert = !!(medical?.allergies?.trim() || medical?.conditions?.trim());

  return NextResponse.json({
    has_alert: hasAlert,
    ...(hasAlert ? {
      medical_alert: {
        allergies: medical?.allergies,
        conditions: medical?.conditions,
      }
    } : {}),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const body = await req.json();
  const { student_id, date, notes, kiosk_mode } = body;

  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

  const today = date || format(new Date(), 'yyyy-MM-dd');

  const student = getStudentById(Number(student_id));
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  if (!kiosk_mode) {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (session.role !== 'admin' && student.group_id) {
      const perms = userGroupPermissions(session.userId, student.group_id, session.role);
      if (!perms?.can_take_attendance) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    checkInStudent(Number(student_id), today, session.userId, notes);
    addAuditLog(
      session.userId,
      session.name || session.email || 'Staff',
      'check_in',
      'student',
      Number(student_id),
      `Checked in ${student.first_name} ${student.last_name} on ${today}`
    );
  } else {
    // Kiosk mode: check in with system user
    checkInStudent(Number(student_id), today, 1, notes);
    addAuditLog(
      null,
      'Kiosk',
      'check_in',
      'student',
      Number(student_id),
      `Kiosk check-in: ${student.first_name} ${student.last_name} on ${today}`
    );
  }

  const alreadyIn = isCheckedIn(Number(student_id), today);

  // Include medical alert info for kiosk to use
  const medical = getMedicalInfo(Number(student_id));
  const hasAlert = !!(medical?.allergies?.trim() || medical?.conditions?.trim());
  const medicalAlert = hasAlert
    ? { allergies: medical?.allergies, conditions: medical?.conditions }
    : undefined;

  return NextResponse.json({
    ok: true,
    already_checked_in: alreadyIn,
    ...(medicalAlert ? { medical_alert: medicalAlert } : {}),
  });
}
