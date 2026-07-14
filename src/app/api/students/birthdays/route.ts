import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getUpcomingBirthdays } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || '7');
  const students = getUpcomingBirthdays(days);
  return NextResponse.json(students);
}
