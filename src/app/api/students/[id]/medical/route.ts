import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStudentById, getMedicalInfo, upsertMedicalInfo, userGroupPermissions } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const student = getStudentById(Number(idStr));
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role !== 'admin' && student.group_id) {
    const perms = userGroupPermissions(session.userId, student.group_id, session.role);
    if (!perms?.can_view_medical) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(getMedicalInfo(Number(idStr)) || {});
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const student = getStudentById(Number(idStr));
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role !== 'admin' && student.group_id) {
    const perms = userGroupPermissions(session.userId, student.group_id, session.role);
    if (!perms?.can_edit_students) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await req.json();
  upsertMedicalInfo(Number(idStr), data);
  return NextResponse.json({ ok: true });
}
