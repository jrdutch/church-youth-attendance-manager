import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

const PUBLIC_PATHS = ['/', '/kiosk'];
const API_PUBLIC = [
  '/api/auth/login', '/api/attendance/checkin', '/api/attendance/checkout',
  '/api/guests/checkin', '/api/webhook/registration', '/api/service/lookup',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || API_PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/kiosk')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/') || pathname.startsWith('/dashboard') ||
      pathname.startsWith('/students') || pathname.startsWith('/attendance') ||
      pathname.startsWith('/reports') || pathname.startsWith('/admin') ||
      pathname.startsWith('/account') || pathname.startsWith('/print') ||
      pathname.startsWith('/service')) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', req.url));
    }

    if (pathname.startsWith('/admin') && session.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
