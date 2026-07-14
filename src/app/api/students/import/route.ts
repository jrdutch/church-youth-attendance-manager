import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createStudent, upsertMedicalInfo, createContact, getAllGroups, addAuditLog } from '@/lib/db';

const COL = {
  firstName:      ['First Name', 'first_name', 'Child First Name'],
  lastName:       ['Last Name',  'last_name',  'Child Last Name'],
  birthdate:      ['Birthdate',  'date_of_birth', 'Birthdate (Child)', 'DOB'],
  grade:          ['Grade', 'grade'],
  gender:         ['Gender', 'gender'],
  shirtSize:      ['Shirt Size', 'shirt_size'],
  school:         ['School', 'school'],
  sacraments:     ['Sacraments Received', 'sacraments_received'],
  photoRelease:   ['Photo Release', 'photo_release'],
  parentsMembers: ['Are Parents Members of OLQP?', 'Are Parents Members?', 'Are Parents Members of the Parish?', 'parents_are_members'],
  foodAllergies:  ['Food Allergies', 'food_allergies'],
  medAllergies:   ['Medical Allergies or Conditions', 'allergies'],
  specialNeeds:   ['Special Learning Needs/Medical Conditions', 'special_needs'],
  parentName:     ['Parent/Guardian Name', 'Parent Name', 'Parent 1 Name', 'Guardian Name'],
  parentPhone:    ['Parent/Guardian Phone', 'Parent Phone', 'Parent 1 Phone'],
  parentEmail:    ['Parent/Guardian Email', 'Parent Email', 'Parent 1 Email'],
  emergencyName:  ['Emergency Contact Name', 'Emergency Contact 1 Name'],
  emergencyPhone: ['Emergency Contact Phone', 'Emergency Contact 1 Phone'],
  emergencyRel:   ['Emergency Contact Relationship', 'Emergency Contact 1 Relationship'],
};

const GRADE_MAP: Record<string, string> = {
  'kindergarten': 'K', 'k': 'K',
  '1st': '1', '1st grade': '1', '1': '1',
  '2nd': '2', '2nd grade': '2', '2': '2',
  '3rd': '3', '3rd grade': '3', '3': '3',
  '4th': '4', '4th grade': '4', '4': '4',
  '5th': '5', '5th grade': '5', '5': '5',
  '6th': '6', '6th grade': '6', '6': '6',
  '7th': '7', '7th grade': '7', '7': '7',
  '8th': '8', '8th grade': '8', '8': '8',
  '9th': '9', '9th grade': '9', '9': '9',
  '10th': '10', '10th grade': '10', '10': '10',
  '11th': '11', '11th grade': '11', '11': '11',
  '12th': '12', '12th grade': '12', '12': '12',
};

const KNOWN_SACRAMENTS = ['Baptism', 'First Communion', 'Reconciliation', 'Confirmation'];

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) { if (row[k] !== undefined && row[k] !== '') return row[k]; }
  return '';
}

function normalizeSacraments(raw: string): string {
  return KNOWN_SACRAMENTS.filter(s => raw.toLowerCase().includes(s.toLowerCase())).join(', ');
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  }
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim(); });
    return obj;
  });
}

// Convert pre-mapped rows (from the students-page spreadsheet importer)
// into the same header-keyed shape the Flocknote CSV parser produces.
function mappedRowsToRecords(rows: Record<string, string>[]): Record<string, string>[] {
  const keyToHeader: Record<string, string> = {
    first_name: 'First Name', last_name: 'Last Name', date_of_birth: 'Birthdate',
    grade: 'Grade', group_name: 'group_name', notes: 'notes',
  };
  return rows.map(r => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[keyToHeader[k] ?? k] = String(v ?? '');
    return out;
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  let rows: Record<string, string>[];
  const legacyRequest = Array.isArray(body.rows);
  if (legacyRequest) {
    // Legacy shape from the students-page spreadsheet importer
    rows = mappedRowsToRecords(body.rows);
  } else {
    const csvText: string = body.csv || '';
    if (!csvText.trim()) return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });
    rows = parseCSV(csvText);
  }
  if (rows.length === 0) return NextResponse.json({ error: 'No data rows found' }, { status: 400 });

  const groups = getAllGroups();
  const results: { name: string; student_id: number }[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = pick(row, COL.firstName);
    const lastName  = pick(row, COL.lastName);
    if (!firstName || !lastName) { errors.push({ row: i + 2, error: 'Missing name' }); continue; }

    const gradeRaw = pick(row, COL.grade).toLowerCase();
    const grade = GRADE_MAP[gradeRaw] || gradeRaw || undefined;
    const ordinals: Record<string, string> = { '1': 'st', '2': 'nd', '3': 'rd' };
    const gradeName = grade === 'K' ? 'Kindergarten'
      : grade ? `${grade}${ordinals[grade] ?? 'th'} Grade` : '';
    // Explicit group name (legacy importer) wins; otherwise auto-assign from grade
    const explicitGroupName = (row['group_name'] || '').toLowerCase().trim();
    const group = (explicitGroupName
      ? groups.find(g => g.name.toLowerCase() === explicitGroupName)
        ?? groups.find(g => g.name.toLowerCase().includes(explicitGroupName))
      : undefined)
      ?? (gradeName ? groups.find(g => g.name.toLowerCase() === gradeName.toLowerCase()) : undefined);

    let dob: string | undefined;
    const birthdateRaw = pick(row, COL.birthdate);
    if (birthdateRaw) { const d = new Date(birthdateRaw); if (!isNaN(d.getTime())) dob = d.toISOString().split('T')[0]; }

    try {
      const studentId = createStudent({
        first_name: firstName, last_name: lastName,
        date_of_birth: dob, grade, group_id: group?.id,
        notes: row['notes'] || undefined,
        is_new_student: 1, enrolled_date: new Date().toISOString().split('T')[0],
        gender: pick(row, COL.gender) || undefined,
        shirt_size: pick(row, COL.shirtSize) || undefined,
        school: pick(row, COL.school) || undefined,
        sacraments_received: normalizeSacraments(pick(row, COL.sacraments)) || undefined,
        photo_release: /yes|true|1/i.test(pick(row, COL.photoRelease)) ? 1 : 0,
        parents_are_members: /yes|true|1/i.test(pick(row, COL.parentsMembers)) ? 1 : 0,
      });

      const foodAllergies = pick(row, COL.foodAllergies);
      const medAllergies = pick(row, COL.medAllergies);
      const specialNeeds = pick(row, COL.specialNeeds);
      if (foodAllergies || medAllergies || specialNeeds) {
        upsertMedicalInfo(studentId, { food_allergies: foodAllergies || undefined, allergies: medAllergies || undefined, special_needs: specialNeeds || undefined });
      }

      const parentName = pick(row, COL.parentName);
      const parentPhone = pick(row, COL.parentPhone);
      if (parentName || parentPhone) {
        const parts = parentName.trim().split(/\s+/);
        createContact(studentId, { first_name: parts[0] || 'Parent', last_name: parts.slice(1).join(' ') || '', relationship: 'parent', phone: parentPhone || undefined, email: pick(row, COL.parentEmail) || undefined, is_primary: 1, can_pickup: 1 });
      }

      const emergencyName = pick(row, COL.emergencyName);
      const emergencyPhone = pick(row, COL.emergencyPhone);
      if (emergencyName || emergencyPhone) {
        const parts = emergencyName.trim().split(/\s+/);
        createContact(studentId, { first_name: parts[0] || 'Emergency', last_name: parts.slice(1).join(' ') || '', relationship: pick(row, COL.emergencyRel) || 'emergency', phone: emergencyPhone || undefined, is_primary: 0, can_pickup: 0 });
      }

      addAuditLog(session.userId, session.name, 'student_imported', 'student', studentId, `${firstName} ${lastName} imported from CSV`);
      results.push({ name: `${firstName} ${lastName}`, student_id: studentId });
    } catch (err) {
      errors.push({ row: i + 2, error: String(err) });
    }
  }

  if (legacyRequest) {
    // Shape expected by the students-page spreadsheet importer
    return NextResponse.json({
      added: results.length,
      errors: errors.map(e => `Row ${e.row}: ${e.error}`),
    });
  }
  return NextResponse.json({ ok: true, imported: results.length, errors, results });
}
