import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getStudentServiceLogs, getStudentServiceTotal, getScholarshipTier } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const studentId = Number(id);
  const logs = getStudentServiceLogs(studentId);
  const total = getStudentServiceTotal(studentId);
  const tier = getScholarshipTier(total);

  return NextResponse.json({ logs, total, tier });
}
