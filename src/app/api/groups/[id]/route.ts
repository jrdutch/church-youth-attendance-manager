import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGroupById, updateGroup, deleteGroup } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const group = getGroupById(Number(idStr));
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(group);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  const data = await req.json();
  updateGroup(Number(idStr), data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  deleteGroup(Number(idStr));
  return NextResponse.json({ ok: true });
}
