import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllUsers, createUser } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(getAllUsers());
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
  }

  try {
    const id = createUser(name, email.toLowerCase().trim(), password, role || 'staff');
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    throw err;
  }
}
