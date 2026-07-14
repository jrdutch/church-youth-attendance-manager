import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateContact, deleteContact } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  const data = await req.json();
  updateContact(Number(idStr), data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: idStr } = await params;
  deleteContact(Number(idStr));
  return NextResponse.json({ ok: true });
}
