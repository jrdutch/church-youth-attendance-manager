import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, updateOwnProfile } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/account — return own profile (name, email, role)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = getUserById(session.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

// PATCH /api/account — update own name, email, or password
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, current_password, new_password } = await req.json();

  // If changing password, verify current password first
  if (new_password) {
    if (!current_password) {
      return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 });
    }
    const user = getUserById(session.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }
  }

  updateOwnProfile(session.userId, { name, email, newPassword: new_password });
  return NextResponse.json({ ok: true });
}
