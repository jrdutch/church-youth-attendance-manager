import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { deleteServiceLog, addAuditLog } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  deleteServiceLog(Number(id));
  addAuditLog(session.userId, session.name, 'service_deleted', 'service_log', Number(id), `Log #${id} deleted`);
  return NextResponse.json({ ok: true });
}
