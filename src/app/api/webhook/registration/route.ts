import { NextRequest, NextResponse } from 'next/server';
import {
  createStudent, upsertMedicalInfo, createContact, getAllGroups, addAuditLog,
} from '@/lib/db';

// Secure this endpoint with a secret token stored in env
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-this-secret';

// Map Flocknote grade labels → our grade values and RE sub-group names
const GRADE_MAP: Record<string, { grade: string; groupName: string }> = {
  'kindergarten': { grade: 'K', groupName: 'Kindergarten' },
  'k':            { grade: 'K', groupName: 'Kindergarten' },
  '1st':          { grade: '1', groupName: '1st Grade' },
  '1st grade':    { grade: '1', groupName: '1st Grade' },
  '1':            { grade: '1', groupName: '1st Grade' },
  '2nd':          { grade: '2', groupName: '2nd Grade' },
  '2nd grade':    { grade: '2', groupName: '2nd Grade' },
  '2':            { grade: '2', groupName: '2nd Grade' },
  '3rd':          { grade: '3', groupName: '3rd Grade' },
  '3rd grade':    { grade: '3', groupName: '3rd Grade' },
  '3':            { grade: '3', groupName: '3rd Grade' },
  '4th':          { grade: '4', groupName: '4th Grade' },
  '4th grade':    { grade: '4', groupName: '4th Grade' },
  '4':            { grade: '4', groupName: '4th Grade' },
  '5th':          { grade: '5', groupName: '5th Grade' },
  '5th grade':    { grade: '5', groupName: '5th Grade' },
  '5':            { grade: '5', groupName: '5th Grade' },
  '6th':          { grade: '6', groupName: '6th Grade' },
  '6th grade':    { grade: '6', groupName: '6th Grade' },
  '6':            { grade: '6', groupName: '6th Grade' },
};

// Normalize a sacraments string from Flocknote into comma-separated canonical names
function normalizeSacraments(raw: string): string {
  if (!raw) return '';
  const known = ['Baptism', 'First Communion', 'Reconciliation', 'Confirmation'];
  return known.filter(s => raw.toLowerCase().includes(s.toLowerCase())).join(', ');
}

// Parse a full name "First Last" into parts
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export async function POST(req: NextRequest) {
  // Verify secret — accept as query param OR Authorization header
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('key');
  const headerSecret = req.headers.get('x-webhook-secret');
  if (querySecret !== WEBHOOK_SECRET && headerSecret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Field extraction ───────────────────────────────────────────
  // Flocknote via Zapier sends fields with their exact label names.
  // We accept both the exact Flocknote labels and common aliases.
  const firstName   = (body['First Name'] || body['first_name'] || body['Child First Name'] || '').trim();
  const lastName    = (body['Last Name']  || body['last_name']  || body['Child Last Name']  || '').trim();
  const birthdate   = (body['Birthdate']  || body['Birthdate (Child)'] || body['date_of_birth'] || '').trim();
  const grade       = (body['Grade']      || body['grade'] || '').trim().toLowerCase();
  const gender      = (body['Gender']     || body['gender'] || '').trim();
  const shirtSize   = (body['Shirt Size'] || body['shirt_size'] || '').trim();
  const school      = (body['School']     || body['school'] || '').trim();
  const sacraments  = normalizeSacraments(body['Sacraments Received'] || body['sacraments_received'] || '');
  const photoRelease       = /yes|true|1/i.test(body['Photo Release'] || '') ? 1 : 0;
  const membershipAnswer = Object.keys(body).find(k => /^are parents members/i.test(k));
  const parentsAreMembers  = /yes|true|1/i.test((membershipAnswer ? body[membershipAnswer] : '') || body['parents_are_members'] || '') ? 1 : 0;

  // Medical fields
  const foodAllergies  = (body['Food Allergies']   || body['food_allergies']  || '').trim();
  const medAllergies   = (body['Medical Allergies or Conditions'] || body['allergies'] || '').trim();
  const specialNeeds   = (body['Special Learning Needs/Medical Conditions'] || body['special_needs'] || '').trim();

  // Emergency / parent contacts — Flocknote sends up to 2 emergency contacts
  const contacts: { name: string; phone: string; email: string; relationship: string; isPrimary: boolean }[] = [];

  // Parent / Guardian
  for (const prefix of ['Parent/Guardian', 'Parent 1', 'Parent', 'Guardian']) {
    const name  = (body[`${prefix} Name`]  || body[`${prefix}_name`]  || '').trim();
    const phone = (body[`${prefix} Phone`] || body[`${prefix}_phone`] || '').trim();
    const email = (body[`${prefix} Email`] || body[`${prefix}_email`] || '').trim();
    if (name || phone || email) {
      contacts.push({ name, phone, email, relationship: 'parent', isPrimary: contacts.length === 0 });
      break;
    }
  }
  // Second parent
  for (const prefix of ['Parent 2', 'Second Parent', 'Guardian 2']) {
    const name  = (body[`${prefix} Name`]  || '').trim();
    const phone = (body[`${prefix} Phone`] || '').trim();
    const email = (body[`${prefix} Email`] || '').trim();
    if (name || phone || email) {
      contacts.push({ name, phone, email, relationship: 'parent', isPrimary: false });
      break;
    }
  }
  // Emergency contact
  for (const prefix of ['Emergency Contact', 'Emergency Contact 1']) {
    const name  = (body[`${prefix} Name`]  || body[`${prefix}_name`]  || '').trim();
    const phone = (body[`${prefix} Phone`] || body[`${prefix}_phone`] || '').trim();
    const rel   = (body[`${prefix} Relationship`] || 'emergency').trim().toLowerCase();
    if (name || phone) {
      contacts.push({ name, phone, email: '', relationship: rel, isPrimary: false });
      break;
    }
  }

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
  }

  // ── Auto-assign RE sub-group from grade ───────────────────────
  let groupId: number | undefined;
  const gradeInfo = GRADE_MAP[grade];
  if (gradeInfo) {
    const groups = getAllGroups();
    const match = groups.find(g => g.name.toLowerCase() === gradeInfo.groupName.toLowerCase());
    if (match) groupId = match.id;
  }

  // ── Normalize birthdate ───────────────────────────────────────
  // Flocknote sends dates in various formats; normalize to YYYY-MM-DD
  let dob: string | undefined;
  if (birthdate) {
    const d = new Date(birthdate);
    if (!isNaN(d.getTime())) {
      dob = d.toISOString().split('T')[0];
    }
  }

  // ── Create student ────────────────────────────────────────────
  const studentId = createStudent({
    first_name: firstName,
    last_name:  lastName,
    date_of_birth: dob,
    grade: gradeInfo?.grade || (grade || undefined),
    group_id: groupId,
    is_new_student: 1,
    enrolled_date: new Date().toISOString().split('T')[0],
    gender:  gender  || undefined,
    shirt_size: shirtSize || undefined,
    school:  school  || undefined,
    sacraments_received: sacraments || undefined,
    photo_release: photoRelease,
    parents_are_members: parentsAreMembers,
  });

  // ── Create medical info (if any provided) ─────────────────────
  if (foodAllergies || medAllergies || specialNeeds) {
    upsertMedicalInfo(studentId, {
      food_allergies: foodAllergies || undefined,
      allergies:     medAllergies  || undefined,
      special_needs: specialNeeds  || undefined,
    });
  }

  // ── Create contacts ────────────────────────────────────────────
  for (const c of contacts) {
    if (!c.name && !c.phone) continue;
    const { first, last } = splitName(c.name || 'Unknown');
    createContact(studentId, {
      first_name:   first,
      last_name:    last,
      relationship: c.relationship,
      phone:        c.phone || undefined,
      email:        c.email || undefined,
      is_primary:   c.isPrimary ? 1 : 0,
      can_pickup:   1,
    });
  }

  addAuditLog(null, 'Flocknote Webhook', 'student_registered', 'student', studentId,
    `${firstName} ${lastName} registered via Flocknote RE enrollment`);

  return NextResponse.json({
    ok: true,
    student_id: studentId,
    name: `${firstName} ${lastName}`,
    group_id: groupId ?? null,
    contacts_created: contacts.filter(c => c.name || c.phone).length,
  });
}
