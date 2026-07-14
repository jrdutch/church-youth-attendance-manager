import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAttendanceReport, getUserGroupAccess } from '@/lib/db';
import { format, subDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const endDate = searchParams.get('end') || format(new Date(), 'yyyy-MM-dd');
  const startDate = searchParams.get('start') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const groupIdParam = searchParams.get('group_id');
  const csvFormat = searchParams.get('format') === 'csv';

  let groupIds: number[] | undefined;
  if (session.role === 'admin') {
    groupIds = groupIdParam ? [Number(groupIdParam)] : undefined;
  } else {
    const access = getUserGroupAccess(session.userId);
    const allowed = access.map(a => a.group_id);
    groupIds = groupIdParam ? allowed.filter(id => id === Number(groupIdParam)) : allowed;
  }

  const data = getAttendanceReport(startDate, endDate, groupIds);

  if (csvFormat) {
    const header = 'First Name,Last Name,Group,Times Attended,Total Sessions,Attendance Rate';
    const rows = data.map(r =>
      `"${r.first_name}","${r.last_name}","${r.group_name}",${r.count},${r.total_sessions},${r.rate}%`
    );
    const csv = [header, ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance-report-${startDate}-to-${endDate}.csv"`,
      },
    });
  }

  return NextResponse.json({ data, startDate, endDate });
}
