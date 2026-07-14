import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkOutStudent, getPickupContacts, isCheckedIn, addAuditLog, getStudentById } from '@/lib/db';
import { format } from 'date-fns';

// GET ?pickup_list=1&student_id=N — authorized pickup adults (used by the kiosk)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get('pickup_list') !== '1') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const studentId = Number(url.searchParams.get('student_id'));
  if (!studentId) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

  return NextResponse.json({ contacts: getPickupContacts(studentId) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const { student_id, date, kiosk_mode, picked_up_by } = body;

  // Staff checkout needs a session; kiosk checkout needs the pickup person's name
  if (!session && !kiosk_mode) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });
  if (kiosk_mode && !session && !String(picked_up_by || '').trim()) {
    return NextResponse.json({ error: 'Please tell us who is picking up' }, { status: 400 });
  }

  const today = date || format(new Date(), 'yyyy-MM-dd');
  if (!isCheckedIn(Number(student_id), today)) {
    return NextResponse.json({ error: 'Student is not checked in today' }, { status: 400 });
  }

  checkOutStudent(Number(student_id), today, session?.userId ?? null, picked_up_by ? String(picked_up_by).trim() : undefined);

  const student = getStudentById(Number(student_id));
  addAuditLog(
    session?.userId ?? null,
    session?.name ?? 'Kiosk',
    'student_checked_out',
    'student',
    Number(student_id),
    `${student?.first_name ?? ''} ${student?.last_name ?? ''} checked out${picked_up_by ? ` — picked up by ${picked_up_by}` : ''}`
  );

  return NextResponse.json({ ok: true });
}
