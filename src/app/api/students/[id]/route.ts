import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStudentById, updateStudent, deleteStudent, getUserGroupAccess, userGroupPermissions } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const student = getStudentById(Number(idStr));
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role !== 'admin' && student.group_id) {
    const access = getUserGroupAccess(session.userId);
    if (!access.find(a => a.group_id === student.group_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Admins always get full permissions; staff viewing an ungrouped student
  // get safe view-only defaults (otherwise the whole profile UI disappears)
  const perms = session.role === 'admin'
    ? { can_view_medical: 1, can_view_contacts: 1, can_edit_students: 1, can_take_attendance: 1 }
    : student.group_id
      ? userGroupPermissions(session.userId, student.group_id, session.role)
      : { can_view_medical: 0, can_view_contacts: 1, can_edit_students: 0, can_take_attendance: 1 };

  return NextResponse.json({ student, permissions: perms });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const student = getStudentById(Number(idStr));
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role !== 'admin') {
    const perms = student.group_id
      ? userGroupPermissions(session.userId, student.group_id, session.role)
      : null;
    if (!perms?.can_edit_students) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await req.json();
  updateStudent(Number(idStr), data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  deleteStudent(Number(idStr));
  return NextResponse.json({ ok: true });
}
