import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserGroupAccess, setUserGroupAccess, removeUserGroupAccess } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  return NextResponse.json(getUserGroupAccess(Number(idStr)));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  const { group_id, can_view_medical, can_view_contacts, can_edit_students, can_take_attendance } = await req.json();
  if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 });

  setUserGroupAccess(Number(idStr), Number(group_id), {
    can_view_medical: can_view_medical ? 1 : 0,
    can_view_contacts: can_view_contacts ? 1 : 0,
    can_edit_students: can_edit_students ? 1 : 0,
    can_take_attendance: can_take_attendance ? 1 : 0,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  const { group_id } = await req.json();
  if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 });
  removeUserGroupAccess(Number(idStr), Number(group_id));
  return NextResponse.json({ ok: true });
}
