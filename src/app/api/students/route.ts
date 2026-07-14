import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getStudents, createStudent, getUserGroupAccess } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role === 'admin') {
    return NextResponse.json(getStudents());
  }

  const access = getUserGroupAccess(session.userId);
  const groupIds = access.map(a => a.group_id);
  return NextResponse.json(getStudents(groupIds));
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  if (!data.first_name || !data.last_name) {
    return NextResponse.json({ error: 'First name and last name required' }, { status: 400 });
  }

  if (session.role !== 'admin' && data.group_id) {
    const access = getUserGroupAccess(session.userId);
    const perm = access.find(a => a.group_id === Number(data.group_id));
    if (!perm?.can_edit_students) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const id = createStudent(data);
  return NextResponse.json({ id }, { status: 201 });
}
