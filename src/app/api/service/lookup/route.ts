import { NextRequest, NextResponse } from 'next/server';
import { lookupServicePoints } from '@/lib/db';

// Public (kiosk) endpoint: teens look up their own point total by name.
// Returns only name, grade, total, and tier — nothing sensitive.
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('name') || '';
  if (name.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }
  return NextResponse.json({ results: lookupServicePoints(name) });
}
