import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAttendanceByDate, getAttendanceStats, getStudentAttendance, getUserGroupAccess, getAttendanceTrend } from '@/lib/db';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const statsMode = searchParams.get('stats') === '1';
  const trendMode = searchParams.get('trend') === '1';
  const groupId = searchParams.get('group_id') ? Number(searchParams.get('group_id')) : undefined;
  const studentId = searchParams.get('student_id') ? Number(searchParams.get('student_id')) : undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;

  if (studentId) {
    return NextResponse.json(getStudentAttendance(studentId, limit));
  }

  if (trendMode) {
    const groupIds = session.role === 'admin'
      ? (groupId ? [groupId] : undefined)
      : getUserGroupAccess(session.userId).map(a => a.group_id);
    return NextResponse.json(getAttendanceTrend(groupIds));
  }

  if (statsMode) {
    return NextResponse.json(getAttendanceStats(groupId));
  }

  if (session.role === 'admin') {
    const groupIds = groupId ? [groupId] : undefined;
    return NextResponse.json(getAttendanceByDate(date, groupIds));
  }

  const access = getUserGroupAccess(session.userId);
  const allowedGroupIds = access.map(a => a.group_id);
  const filterIds = groupId
    ? allowedGroupIds.filter(id => id === groupId)
    : allowedGroupIds;

  return NextResponse.json(getAttendanceByDate(date, filterIds));
}
