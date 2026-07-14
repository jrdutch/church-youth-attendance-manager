import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getStudentById, updateStudent } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const studentId = Number(id);
  const student = getStudentById(studentId);
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('photo') as File | null;
  if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  const timestamp = Date.now();
  const filename = `student-${studentId}-${timestamp}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'students');
  await mkdir(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const photo_url = `/uploads/students/${filename}`;
  updateStudent(studentId, { photo_url });

  return NextResponse.json({ photo_url });
}
