import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllGroups, createGroup, getUserGroupAccess } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = getAllGroups();
  if (session.role === 'admin') return NextResponse.json(groups);

  const access = getUserGroupAccess(session.userId);
  const allowedIds = new Set(access.map(a => a.group_id));
  return NextResponse.json(groups.filter(g => allowedIds.has(g.id)));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const data = await req.json();
  if (!data.name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const id = createGroup({
    name: data.name,
    description: data.description,
    type: data.type || 'general',
    color: data.color || '#4263eb',
    parent_id: data.parent_id ? Number(data.parent_id) : undefined,
  });
  return NextResponse.json({ id }, { status: 201 });
}
