import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateUser, deleteUser } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  const data = await req.json();
  const update: Record<string, unknown> = {};

  if (data.name) update.name = data.name;
  if (data.email) update.email = data.email.toLowerCase().trim();
  if (data.role) update.role = data.role;
  if (typeof data.is_active === 'number') update.is_active = data.is_active;
  if (data.password) {
    update.password_hash = bcrypt.hashSync(data.password, 10);
  }

  updateUser(Number(idStr), update as Parameters<typeof updateUser>[1]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id: idStr } = await params;
  if (Number(idStr) === session.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }
  deleteUser(Number(idStr));
  return NextResponse.json({ ok: true });
}
