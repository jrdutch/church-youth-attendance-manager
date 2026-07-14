import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateGuest, recordGuestVisit } from '@/lib/db';
import { format } from 'date-fns';

// Public endpoint — used by kiosk (no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { first_name, last_name, phone, date } = body;

    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: 'Emergency contact number is required' }, { status: 400 });
    }

    const today = date || format(new Date(), 'yyyy-MM-dd');
    const guest = findOrCreateGuest(first_name.trim(), last_name.trim(), phone.trim());
    const { visitCount, converted, studentId } = recordGuestVisit(guest.id, today);

    return NextResponse.json({
      ok: true,
      guest_id: guest.id,
      first_name: guest.first_name,
      last_name: guest.last_name,
      visit_count: visitCount,
      converted,
      student_id: studentId,
      // tell the kiosk how to customise the success screen
      is_first_visit: visitCount === 1,
      // conversion happens on the 4th visit (> 3 previous)
      just_converted: converted && visitCount > 3,
    });
  } catch (err) {
    console.error('Guest check-in error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
