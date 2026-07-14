import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAbsentStudents } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Number(new URL(req.url).searchParams.get('days')) || 21;
  return NextResponse.json(getAbsentStudents(days));
}
