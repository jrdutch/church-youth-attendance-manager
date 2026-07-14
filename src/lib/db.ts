import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'church.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  // Migrations for columns added after initial release
  try { db.exec('ALTER TABLE groups ADD COLUMN parent_id INTEGER REFERENCES groups(id)'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN is_new_student INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN enrolled_date TEXT'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN family_id INTEGER REFERENCES families(id)'); } catch {}
  // Flocknote registration fields
  try { db.exec('ALTER TABLE students ADD COLUMN gender TEXT'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN shirt_size TEXT'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN school TEXT'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN sacraments_received TEXT'); } catch {}
  try { db.exec("ALTER TABLE students ADD COLUMN photo_release INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE students ADD COLUMN parents_are_members INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec('ALTER TABLE medical_info ADD COLUMN food_allergies TEXT'); } catch {}
  try { db.exec('ALTER TABLE medical_info ADD COLUMN special_needs TEXT'); } catch {}
  try { db.exec('ALTER TABLE attendance ADD COLUMN picked_up_by TEXT'); } catch {}
  try { db.exec('ALTER TABLE students ADD COLUMN sacrament_prep TEXT'); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'general',
      color TEXT NOT NULL DEFAULT '#4263eb',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT,
      grade TEXT,
      group_id INTEGER REFERENCES groups(id),
      photo_url TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medical_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE CASCADE,
      allergies TEXT,
      conditions TEXT,
      medications TEXT,
      doctor_name TEXT,
      doctor_phone TEXT,
      insurance_info TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      can_pickup INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      checked_in_by INTEGER REFERENCES users(id),
      checked_out_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_group_access (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      can_view_medical INTEGER NOT NULL DEFAULT 0,
      can_view_contacts INTEGER NOT NULL DEFAULT 1,
      can_edit_students INTEGER NOT NULL DEFAULT 0,
      can_take_attendance INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      visit_count INTEGER NOT NULL DEFAULT 0,
      converted_student_id INTEGER REFERENCES students(id),
      last_visit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS guest_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS service_event_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      base_points INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      event_type_id INTEGER REFERENCES service_event_types(id),
      event_name TEXT NOT NULL,
      date TEXT NOT NULL,
      base_points INTEGER NOT NULL DEFAULT 0,
      leadership_bonus INTEGER NOT NULL DEFAULT 0,
      reflection_bonus INTEGER NOT NULL DEFAULT 0,
      bonus_points INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      logged_by_id INTEGER REFERENCES users(id),
      logged_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_student ON contacts(student_id);
    CREATE INDEX IF NOT EXISTS idx_service_logs_student ON service_logs(student_id);
    CREATE INDEX IF NOT EXISTS idx_service_logs_date ON service_logs(date);
  `);

  seedDefaults(db);
}

function seedDefaults(db: Database.Database) {
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`)
      .run('Administrator', 'admin@church.local', hash, 'admin');

    db.prepare(`INSERT INTO groups (name, description, type, color) VALUES (?, ?, ?, ?)`)
      .run('Youth Group', 'Middle & High School Youth Ministry', 'youth', '#4263eb');

    db.prepare(`INSERT INTO groups (name, description, type, color) VALUES (?, ?, ?, ?)`)
      .run('Religious Education', 'Elementary Age Children (K-6)', 'elementary', '#10b981');

    console.log('Database initialized with default admin account and groups.');
    console.log('Default login: admin@church.local / admin123');
  }

  // Always ensure service event types exist (idempotent seed)
  const SERVICE_EVENTS = [
    { name: 'Enchilada Dinner Volunteer',      description: 'Serve, prep, or clean up at parish dinner',            base_points: 10 },
    { name: 'Nursery (Sunday Mornings)',        description: 'Supervise children during Mass/services',              base_points: 8  },
    { name: 'Parish Breakfast Set-up/Cleanup', description: 'Help with parish breakfast, before/after',             base_points: 6  },
    { name: 'Vacation Bible School',           description: 'Help with VBS (per day served)',                       base_points: 8  },
    { name: 'RE Classroom Helper',             description: 'Assist teacher during Religious Ed class',             base_points: 7  },
    { name: 'RE Cleanup',                      description: 'Clean up after Religious Ed classes',                   base_points: 3  },
    { name: 'Altar Server',                    description: 'Serve at Mass (per service)',                           base_points: 5  },
    { name: 'Lector',                          description: 'Read at Mass',                                         base_points: 7  },
    { name: 'Choir',                           description: 'Sing/play for Mass or events',                         base_points: 6  },
    { name: 'Usher',                           description: 'Greet, collect offering, help during Mass',            base_points: 5  },
    { name: 'Community Service Project',       description: 'Parish/community project (e.g., service day)',         base_points: 12 },
    { name: 'Parish Picnic Volunteer',         description: 'Set up, serve, lead games, or clean up',              base_points: 9  },
    { name: 'Trunk or Treat Volunteer',        description: 'Set up, host trunk, or cleanup',                       base_points: 7  },
    { name: 'Attending Sanctus Retreat',       description: 'Full weekend retreat attendance',                      base_points: 10 },
    { name: 'Turkey Dinner Volunteer',         description: 'Serve, prep, or clean up',                             base_points: 10 },
    { name: 'Easter Egg Hunt Volunteer',       description: 'Set up, run, or clean up event',                       base_points: 8  },
    { name: 'Leading Stations of the Cross',   description: 'Participate as leader/reader',                         base_points: 10 },
    { name: '90%+ Youth Group Attendance',     description: 'Consistent attendance for semester/year (bonus)',      base_points: 20 },
  ];
  for (const ev of SERVICE_EVENTS) {
    const exists = db.prepare('SELECT id FROM service_event_types WHERE name = ?').get(ev.name);
    if (!exists) {
      db.prepare('INSERT INTO service_event_types (name, description, base_points) VALUES (?, ?, ?)')
        .run(ev.name, ev.description, ev.base_points);
    }
  }

  // Always ensure RE sub-groups exist (idempotent migration)
  const re = db.prepare("SELECT id FROM groups WHERE name = 'Religious Education' AND (parent_id IS NULL) LIMIT 1")
    .get() as { id: number } | undefined;
  if (re) {
    const subGroups = [
      'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade',
      '4th Grade', '5th Grade', '6th Grade',
    ];
    for (const name of subGroups) {
      const exists = db.prepare('SELECT id FROM groups WHERE name = ? AND parent_id = ?').get(name, re.id);
      if (!exists) {
        db.prepare(`INSERT INTO groups (name, type, color, parent_id) VALUES (?, ?, ?, ?)`)
          .run(name, 'elementary', '#10b981', re.id);
      }
    }
  }
}

// ─── User queries ──────────────────────────────────────────────
export function getUserByEmail(email: string) {
  return getDb().prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email) as DbUser | undefined;
}

export function getUserById(id: number) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
}

export function getAllUsers() {
  return getDb().prepare('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name').all() as PublicUser[];
}

export function createUser(name: string, email: string, password: string, role: string) {
  const hash = bcrypt.hashSync(password, 10);
  const result = getDb().prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
  `).run(name, email, hash, role);
  return result.lastInsertRowid as number;
}

export function updateUser(id: number, data: Partial<{ name: string; email: string; role: string; is_active: number; password_hash: string }>) {
  const db = getDb();
  const allowed = ['name', 'email', 'role', 'is_active', 'password_hash'];
  const fields = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string, unknown>)[k] !== undefined).map(k => `${k} = ?`).join(', ');
  if (!fields) return;
  const values = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string, unknown>)[k] !== undefined).map(k => (data as Record<string, unknown>)[k]);
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values, id);
}

export function updateOwnProfile(userId: number, data: { name?: string; email?: string; newPassword?: string }) {
  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (data.name?.trim()) updates.name = data.name.trim();
  if (data.email?.trim()) updates.email = data.email.toLowerCase().trim();
  if (data.newPassword) updates.password_hash = bcrypt.hashSync(data.newPassword, 10);
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (!fields) return;
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...Object.values(updates), userId);
}

export function deleteUser(id: number) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ─── User permissions ──────────────────────────────────────────
export function getUserGroupAccess(userId: number) {
  return getDb().prepare(`
    SELECT uga.*, g.name as group_name, g.color as group_color
    FROM user_group_access uga
    JOIN groups g ON g.id = uga.group_id
    WHERE uga.user_id = ?
  `).all(userId) as UserGroupAccess[];
}

export function setUserGroupAccess(userId: number, groupId: number, perms: {
  can_view_medical: number;
  can_view_contacts: number;
  can_edit_students: number;
  can_take_attendance: number;
}) {
  getDb().prepare(`
    INSERT INTO user_group_access (user_id, group_id, can_view_medical, can_view_contacts, can_edit_students, can_take_attendance)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, group_id) DO UPDATE SET
      can_view_medical = excluded.can_view_medical,
      can_view_contacts = excluded.can_view_contacts,
      can_edit_students = excluded.can_edit_students,
      can_take_attendance = excluded.can_take_attendance
  `).run(userId, groupId, perms.can_view_medical, perms.can_view_contacts, perms.can_edit_students, perms.can_take_attendance);
}

export function removeUserGroupAccess(userId: number, groupId: number) {
  getDb().prepare('DELETE FROM user_group_access WHERE user_id = ? AND group_id = ?').run(userId, groupId);
}

export function userCanAccessGroup(userId: number, groupId: number, role: string): boolean {
  if (role === 'admin') return true;
  const access = getDb().prepare(
    'SELECT id FROM user_group_access WHERE user_id = ? AND group_id = ?'
  ).get(userId, groupId);
  return !!access;
}

export function userGroupPermissions(userId: number, groupId: number, role: string) {
  if (role === 'admin') {
    return { can_view_medical: 1, can_view_contacts: 1, can_edit_students: 1, can_take_attendance: 1 };
  }
  return getDb().prepare(
    'SELECT * FROM user_group_access WHERE user_id = ? AND group_id = ?'
  ).get(userId, groupId) as UserGroupAccess | undefined;
}

// ─── Group queries ─────────────────────────────────────────────
export function getAllGroups() {
  return getDb().prepare('SELECT * FROM groups WHERE is_active = 1 ORDER BY name').all() as Group[];
}

export function getGroupById(id: number) {
  return getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined;
}

export function createGroup(data: { name: string; description?: string; type: string; color: string; parent_id?: number }) {
  const result = getDb().prepare(`
    INSERT INTO groups (name, description, type, color, parent_id) VALUES (?, ?, ?, ?, ?)
  `).run(data.name, data.description || null, data.type, data.color, data.parent_id || null);
  return result.lastInsertRowid as number;
}

export function updateGroup(id: number, data: Partial<Group>) {
  const allowed = ['name', 'description', 'type', 'color', 'is_active', 'parent_id'];
  const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(data).filter(k => allowed.includes(k)).map(k => (data as Record<string, unknown>)[k]);
  if (!fields) return;
  getDb().prepare(`UPDATE groups SET ${fields} WHERE id = ?`).run(...values, id);
}

export function deleteGroup(id: number) {
  getDb().prepare('DELETE FROM groups WHERE id = ?').run(id);
}

// ─── Student queries ───────────────────────────────────────────
export function getStudents(groupIds?: number[]) {
  if (!groupIds || groupIds.length === 0) {
    return getDb().prepare(`
      SELECT s.*, g.name as group_name, g.color as group_color, g.type as group_type
      FROM students s LEFT JOIN groups g ON g.id = s.group_id
      WHERE s.is_active = 1 ORDER BY s.last_name, s.first_name
    `).all() as StudentWithGroup[];
  }
  const placeholders = groupIds.map(() => '?').join(',');
  return getDb().prepare(`
    SELECT s.*, g.name as group_name, g.color as group_color, g.type as group_type
    FROM students s LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.is_active = 1 AND s.group_id IN (${placeholders})
    ORDER BY s.last_name, s.first_name
  `).all(...groupIds) as StudentWithGroup[];
}

export function getStudentById(id: number) {
  return getDb().prepare(`
    SELECT s.*, g.name as group_name, g.color as group_color
    FROM students s LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.id = ?
  `).get(id) as StudentWithGroup | undefined;
}

export function createStudent(data: {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  grade?: string;
  group_id?: number;
  photo_url?: string;
  notes?: string;
  is_new_student?: number;
  enrolled_date?: string;
  family_id?: number;
  gender?: string;
  shirt_size?: string;
  school?: string;
  sacraments_received?: string;
  photo_release?: number;
  parents_are_members?: number;
  sacrament_prep?: string;
}) {
  const result = getDb().prepare(`
    INSERT INTO students (first_name, last_name, date_of_birth, grade, group_id, photo_url, notes,
      is_new_student, enrolled_date, family_id, gender, shirt_size, school,
      sacraments_received, photo_release, parents_are_members, sacrament_prep)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.first_name, data.last_name,
    data.date_of_birth || null, data.grade || null,
    data.group_id || null, data.photo_url || null, data.notes || null,
    data.is_new_student ?? 0, data.enrolled_date || null, data.family_id || null,
    data.gender || null, data.shirt_size || null, data.school || null,
    data.sacraments_received || null, data.photo_release ?? 0, data.parents_are_members ?? 0,
    data.sacrament_prep || null
  );
  return result.lastInsertRowid as number;
}

export function updateStudent(id: number, data: Partial<{
  first_name: string; last_name: string; date_of_birth: string;
  grade: string; group_id: number; photo_url: string; notes: string; is_active: number;
  is_new_student: number; enrolled_date: string; family_id: number | null;
  gender: string; shirt_size: string; school: string;
  sacraments_received: string; photo_release: number; parents_are_members: number;
  sacrament_prep: string;
}>) {
  const allowed = [
    'first_name', 'last_name', 'date_of_birth', 'grade', 'group_id', 'photo_url', 'notes',
    'is_active', 'is_new_student', 'enrolled_date', 'family_id',
    'gender', 'shirt_size', 'school', 'sacraments_received', 'photo_release', 'parents_are_members',
    'sacrament_prep',
  ];
  const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(data).filter(k => allowed.includes(k)).map(k => (data as Record<string, unknown>)[k]);
  if (!fields) return;
  getDb().prepare(`UPDATE students SET ${fields} WHERE id = ?`).run(...values, id);
}

export function deleteStudent(id: number) {
  getDb().prepare('UPDATE students SET is_active = 0 WHERE id = ?').run(id);
}

// ─── Medical info ──────────────────────────────────────────────
export function getMedicalInfo(studentId: number) {
  return getDb().prepare('SELECT * FROM medical_info WHERE student_id = ?').get(studentId) as MedicalInfo | undefined;
}

export function upsertMedicalInfo(studentId: number, data: Partial<MedicalInfo>) {
  const allowed = ['food_allergies', 'allergies', 'conditions', 'special_needs', 'medications', 'doctor_name', 'doctor_phone', 'insurance_info', 'notes'];
  getDb().prepare(`
    INSERT INTO medical_info (student_id, ${allowed.join(', ')}, updated_at)
    VALUES (?, ${allowed.map(() => '?').join(', ')}, datetime('now'))
    ON CONFLICT(student_id) DO UPDATE SET
      ${allowed.map(k => `${k} = excluded.${k}`).join(', ')},
      updated_at = datetime('now')
  `).run(studentId, ...allowed.map(k => (data as Record<string, unknown>)[k] ?? null));
}

// ─── Contacts ──────────────────────────────────────────────────
export function getContacts(studentId: number) {
  return getDb().prepare('SELECT * FROM contacts WHERE student_id = ? ORDER BY is_primary DESC').all(studentId) as Contact[];
}

export function createContact(studentId: number, data: Omit<Contact, 'id' | 'student_id' | 'created_at'>) {
  const result = getDb().prepare(`
    INSERT INTO contacts (student_id, first_name, last_name, relationship, phone, email, is_primary, can_pickup)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(studentId, data.first_name, data.last_name, data.relationship, data.phone || null, data.email || null, data.is_primary ? 1 : 0, data.can_pickup ? 1 : 0);
  return result.lastInsertRowid as number;
}

export function updateContact(id: number, data: Partial<Contact>) {
  const allowed = ['first_name', 'last_name', 'relationship', 'phone', 'email', 'is_primary', 'can_pickup'];
  const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(data).filter(k => allowed.includes(k)).map(k => (data as Record<string, unknown>)[k]);
  if (!fields) return;
  getDb().prepare(`UPDATE contacts SET ${fields} WHERE id = ?`).run(...values, id);
}

export function deleteContact(id: number) {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id);
}

// ─── Attendance ────────────────────────────────────────────────
export function getAttendanceByDate(date: string, groupIds?: number[]) {
  if (!groupIds || groupIds.length === 0) {
    return getDb().prepare(`
      SELECT a.*, s.first_name, s.last_name, s.photo_url, s.group_id,
             g.name as group_name, g.color as group_color,
             u.name as checked_in_by_name
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      LEFT JOIN groups g ON g.id = s.group_id
      LEFT JOIN users u ON u.id = a.checked_in_by
      WHERE a.date = ?
      ORDER BY a.check_in_time
    `).all(date) as AttendanceRecord[];
  }
  const placeholders = groupIds.map(() => '?').join(',');
  return getDb().prepare(`
    SELECT a.*, s.first_name, s.last_name, s.photo_url, s.group_id,
           g.name as group_name, g.color as group_color,
           u.name as checked_in_by_name
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    LEFT JOIN groups g ON g.id = s.group_id
    LEFT JOIN users u ON u.id = a.checked_in_by
    WHERE a.date = ? AND s.group_id IN (${placeholders})
    ORDER BY a.check_in_time
  `).all(date, ...groupIds) as AttendanceRecord[];
}

export function getStudentAttendance(studentId: number, limit = 20) {
  return getDb().prepare(`
    SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT ?
  `).all(studentId, limit) as AttendanceRecord[];
}

export function getTodayCheckedIn(date: string, groupIds?: number[]): number {
  if (!groupIds || groupIds.length === 0) {
    const row = getDb().prepare('SELECT COUNT(*) as count FROM attendance WHERE date = ? AND check_in_time IS NOT NULL').get(date) as { count: number };
    return row.count;
  }
  const placeholders = groupIds.map(() => '?').join(',');
  const row = getDb().prepare(`
    SELECT COUNT(*) as count FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE a.date = ? AND a.check_in_time IS NOT NULL AND s.group_id IN (${placeholders})
  `).get(date, ...groupIds) as { count: number };
  return row.count;
}

export function checkInStudent(studentId: number, date: string, checkedInBy: number, notes?: string) {
  const existing = getDb().prepare(
    'SELECT id FROM attendance WHERE student_id = ? AND date = ?'
  ).get(studentId, date);
  if (existing) {
    // Re-check-in (e.g., returning after checkout): clear the old checkout
    getDb().prepare(
      "UPDATE attendance SET check_in_time = datetime('now'), checked_in_by = ?, check_out_time = NULL, checked_out_by = NULL, picked_up_by = NULL WHERE student_id = ? AND date = ?"
    ).run(checkedInBy, studentId, date);
  } else {
    getDb().prepare(`
      INSERT INTO attendance (student_id, date, check_in_time, checked_in_by, notes)
      VALUES (?, ?, datetime('now'), ?, ?)
    `).run(studentId, date, checkedInBy, notes || null);
  }
}

export function checkOutStudent(studentId: number, date: string, checkedOutBy: number | null, pickedUpBy?: string) {
  getDb().prepare(
    "UPDATE attendance SET check_out_time = datetime('now'), checked_out_by = ?, picked_up_by = ? WHERE student_id = ? AND date = ?"
  ).run(checkedOutBy, pickedUpBy || null, studentId, date);
}

export function getPickupContacts(studentId: number) {
  return getDb().prepare(
    'SELECT first_name, last_name, relationship FROM contacts WHERE student_id = ? AND can_pickup = 1 ORDER BY is_primary DESC'
  ).all(studentId) as { first_name: string; last_name: string; relationship: string }[];
}

export function isCheckedIn(studentId: number, date: string): boolean {
  const row = getDb().prepare(
    'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND check_in_time IS NOT NULL'
  ).get(studentId, date);
  return !!row;
}

export function getAttendanceStats(groupId?: number) {
  const db = getDb();
  const last30 = db.prepare(`
    SELECT a.date, COUNT(*) as count
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE a.check_in_time IS NOT NULL
    ${groupId ? 'AND s.group_id = ?' : ''}
    AND a.date >= date('now', '-30 days')
    GROUP BY a.date ORDER BY a.date
  `).all(...(groupId ? [groupId] : [])) as { date: string; count: number }[];
  return last30;
}

// ─── Birthday reminders ────────────────────────────────────────
export function getUpcomingBirthdays(days = 7): StudentWithGroup[] {
  const students = getDb().prepare(`
    SELECT s.*, g.name as group_name, g.color as group_color, g.type as group_type
    FROM students s LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.is_active = 1 AND s.date_of_birth IS NOT NULL
  `).all() as StudentWithGroup[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return students.filter(s => {
    if (!s.date_of_birth) return false;
    const dob = new Date(s.date_of_birth + 'T00:00:00');
    // Compute birthday this year and next year
    const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    const birthdayNextYear = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
    const target = birthdayThisYear >= today ? birthdayThisYear : birthdayNextYear;
    const diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= days;
  });
}

// ─── Attendance trend ──────────────────────────────────────────
export function getAttendanceTrend(groupIds?: number[]): { week: string; count: number }[] {
  const db = getDb();
  const results: { week: string; count: number }[] = [];

  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let row: { count: number };
    if (!groupIds || groupIds.length === 0) {
      row = db.prepare(`
        SELECT COUNT(DISTINCT a.student_id) as count
        FROM attendance a
        WHERE a.date >= ? AND a.date <= ? AND a.check_in_time IS NOT NULL
      `).get(startStr, endStr) as { count: number };
    } else {
      const placeholders = groupIds.map(() => '?').join(',');
      row = db.prepare(`
        SELECT COUNT(DISTINCT a.student_id) as count
        FROM attendance a JOIN students s ON s.id = a.student_id
        WHERE a.date >= ? AND a.date <= ? AND a.check_in_time IS NOT NULL
        AND s.group_id IN (${placeholders})
      `).get(startStr, endStr, ...groupIds) as { count: number };
    }
    results.push({ week: label, count: row?.count ?? 0 });
  }
  return results;
}

// ─── Attendance report ─────────────────────────────────────────
export function getAttendanceReport(startDate: string, endDate: string, groupIds?: number[]) {
  const db = getDb();

  // Count total session days in range
  let sessionRows: { date: string }[];
  if (!groupIds || groupIds.length === 0) {
    sessionRows = db.prepare(
      `SELECT DISTINCT date FROM attendance WHERE date >= ? AND date <= ? AND check_in_time IS NOT NULL`
    ).all(startDate, endDate) as { date: string }[];
  } else {
    const ph = groupIds.map(() => '?').join(',');
    sessionRows = db.prepare(`
      SELECT DISTINCT a.date FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE a.date >= ? AND a.date <= ? AND a.check_in_time IS NOT NULL
      AND s.group_id IN (${ph})
    `).all(startDate, endDate, ...groupIds) as { date: string }[];
  }
  const totalSessions = sessionRows.length;

  let rows: { student_id: number; first_name: string; last_name: string; group_name: string; count: number }[];
  if (!groupIds || groupIds.length === 0) {
    rows = db.prepare(`
      SELECT s.id as student_id, s.first_name, s.last_name,
             COALESCE(g.name, 'No Group') as group_name,
             COUNT(a.id) as count
      FROM students s
      LEFT JOIN groups g ON g.id = s.group_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.date >= ? AND a.date <= ? AND a.check_in_time IS NOT NULL
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY s.last_name, s.first_name
    `).all(startDate, endDate) as typeof rows;
  } else {
    const ph = groupIds.map(() => '?').join(',');
    rows = db.prepare(`
      SELECT s.id as student_id, s.first_name, s.last_name,
             COALESCE(g.name, 'No Group') as group_name,
             COUNT(a.id) as count
      FROM students s
      LEFT JOIN groups g ON g.id = s.group_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.date >= ? AND a.date <= ? AND a.check_in_time IS NOT NULL
      WHERE s.is_active = 1 AND s.group_id IN (${ph})
      GROUP BY s.id
      ORDER BY s.last_name, s.first_name
    `).all(startDate, endDate, ...groupIds) as typeof rows;
  }

  return rows.map(r => ({
    ...r,
    total_sessions: totalSessions,
    rate: totalSessions > 0 ? Math.round((r.count / totalSessions) * 100) : 0,
  }));
}

// ─── Family queries ─────────────────────────────────────────────
export function getAllFamilies() {
  return getDb().prepare('SELECT * FROM families ORDER BY name').all() as Family[];
}

export function getFamilyById(id: number) {
  return getDb().prepare('SELECT * FROM families WHERE id = ?').get(id) as Family | undefined;
}

export function createFamily(name: string, notes?: string) {
  const result = getDb().prepare('INSERT INTO families (name, notes) VALUES (?, ?)').run(name, notes || null);
  return result.lastInsertRowid as number;
}

export function updateFamily(id: number, data: Partial<{ name: string; notes: string }>) {
  const allowed = ['name', 'notes'];
  const fields = Object.keys(data).filter(k => allowed.includes(k)).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(data).filter(k => allowed.includes(k)).map(k => (data as Record<string, unknown>)[k]);
  if (!fields) return;
  getDb().prepare(`UPDATE families SET ${fields} WHERE id = ?`).run(...values, id);
}

export function deleteFamily(id: number) {
  getDb().prepare('DELETE FROM families WHERE id = ?').run(id);
}

export function getStudentsByFamily(familyId: number) {
  return getDb().prepare(`
    SELECT s.*, g.name as group_name, g.color as group_color
    FROM students s LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.family_id = ? AND s.is_active = 1
    ORDER BY s.last_name, s.first_name
  `).all(familyId) as StudentWithGroup[];
}

export function updateStudentFamily(studentId: number, familyId: number | null) {
  getDb().prepare('UPDATE students SET family_id = ? WHERE id = ?').run(familyId, studentId);
}

// ─── Audit log ─────────────────────────────────────────────────
export function addAuditLog(
  userId: number | null,
  userName: string,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: string
) {
  getDb().prepare(`
    INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, action, entityType || null, entityId || null, details || null);
}

export function getAuditLogs(limit = 100) {
  return getDb().prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as AuditLog[];
}

// ─── Guest queries ─────────────────────────────────────────────
export function findGuestByPhone(phone: string) {
  // Normalize phone to digits only for comparison
  const digits = phone.replace(/\D/g, '');
  return getDb().prepare(
    "SELECT * FROM guests WHERE replace(replace(replace(replace(replace(phone,' ',''),'-',''),'(',')',')',''),' ','') = ? OR phone = ?"
  ).get(digits, phone) as Guest | undefined;
}

export function getAllGuests() {
  return getDb().prepare(`
    SELECT g.*, s.first_name as student_first, s.last_name as student_last
    FROM guests g
    LEFT JOIN students s ON s.id = g.converted_student_id
    ORDER BY g.last_visit DESC, g.created_at DESC
  `).all() as (Guest & { student_first?: string; student_last?: string })[];
}

export function getGuestById(id: number) {
  return getDb().prepare('SELECT * FROM guests WHERE id = ?').get(id) as Guest | undefined;
}

/** Find guest by phone (digit-normalised), create if not found. Returns guest record. */
export function findOrCreateGuest(firstName: string, lastName: string, phone: string): Guest {
  const db = getDb();
  const normalised = phone.replace(/\D/g, '');
  // Try matching by stripped phone digits
  let guest = db.prepare(`SELECT * FROM guests WHERE replace(replace(replace(phone,'(',''),')',''),'-','') = ? OR phone = ?`)
    .get(normalised, phone) as Guest | undefined;
  if (!guest) {
    const res = db.prepare('INSERT INTO guests (first_name, last_name, phone) VALUES (?, ?, ?)')
      .run(firstName, lastName, phone);
    guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(res.lastInsertRowid) as Guest;
  }
  return guest;
}

/** Record a guest visit. Returns updated visit_count and whether conversion was triggered. */
export function recordGuestVisit(guestId: number, date: string): { visitCount: number; converted: boolean; studentId?: number } {
  const db = getDb();
  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId) as Guest;
  if (!guest) return { visitCount: 0, converted: false };

  // Don't double-count same-day visits
  const alreadyToday = db.prepare('SELECT id FROM guest_visits WHERE guest_id = ? AND date = ?').get(guestId, date);
  if (alreadyToday) return { visitCount: guest.visit_count, converted: !!guest.converted_student_id, studentId: guest.converted_student_id ?? undefined };

  // Record the visit
  db.prepare('INSERT INTO guest_visits (guest_id, date) VALUES (?, ?)').run(guestId, date);
  const newCount = guest.visit_count + 1;
  db.prepare("UPDATE guests SET visit_count = ?, last_visit = ? WHERE id = ?").run(newCount, date, guestId);

  // Auto-convert after 3 visits (i.e., on the 4th check-in)
  if (newCount > 3 && !guest.converted_student_id) {
    const studentId = convertGuestToStudent(guestId);
    return { visitCount: newCount, converted: true, studentId };
  }

  return { visitCount: newCount, converted: false };
}

/** Convert a guest to a new student record with onboarding flag. */
export function convertGuestToStudent(guestId: number): number {
  const db = getDb();
  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId) as Guest;
  if (!guest) throw new Error('Guest not found');

  const studentId = createStudent({
    first_name: guest.first_name,
    last_name: guest.last_name,
    notes: `Converted from guest. Emergency contact: ${guest.phone}`,
    is_new_student: 1,
    enrolled_date: new Date().toISOString().split('T')[0],
  });

  // Add phone as emergency contact
  createContact(studentId, {
    first_name: guest.first_name,
    last_name: guest.last_name,
    relationship: 'emergency',
    phone: guest.phone,
    is_primary: 1,
    can_pickup: 1,
  });

  db.prepare('UPDATE guests SET converted_student_id = ? WHERE id = ?').run(studentId, guestId);

  addAuditLog(null, 'System', 'guest_converted', 'guest', guestId,
    `Guest ${guest.first_name} ${guest.last_name} converted to student #${studentId} after ${guest.visit_count + 1} visits`);

  return studentId;
}

export function getGuestVisits(guestId: number) {
  return getDb().prepare('SELECT * FROM guest_visits WHERE guest_id = ? ORDER BY date DESC').all(guestId) as GuestVisit[];
}

// ─── Types ─────────────────────────────────────────────────────
export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'staff';
  is_active: number;
  created_at: string;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  is_active: number;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  type: string;
  color: string;
  parent_id?: number;
  is_active: number;
  created_at: string;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  grade?: string;
  group_id?: number;
  photo_url?: string;
  notes?: string;
  is_active: number;
  created_at: string;
  is_new_student?: number;
  enrolled_date?: string;
  family_id?: number;
  // Flocknote registration fields
  gender?: string;
  shirt_size?: string;
  school?: string;
  sacraments_received?: string;
  photo_release?: number;
  parents_are_members?: number;
  sacrament_prep?: string;
}

export interface Family {
  id: number;
  name: string;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  created_at: string;
}

export interface Guest {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  visit_count: number;
  converted_student_id?: number;
  last_visit?: string;
  created_at: string;
}

export interface GuestVisit {
  id: number;
  guest_id: number;
  date: string;
  created_at: string;
}

export interface StudentWithGroup extends Student {
  group_name?: string;
  group_color?: string;
  group_type?: string;
}

export interface MedicalInfo {
  id: number;
  student_id: number;
  food_allergies?: string;
  allergies?: string;
  conditions?: string;
  special_needs?: string;
  medications?: string;
  doctor_name?: string;
  doctor_phone?: string;
  insurance_info?: string;
  notes?: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  relationship: string;
  phone?: string;
  email?: string;
  is_primary: number;
  can_pickup: number;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  checked_in_by?: number;
  checked_out_by?: number;
  notes?: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  group_id?: number;
  group_name?: string;
  group_color?: string;
  checked_in_by_name?: string;
}

export interface UserGroupAccess {
  user_id: number;
  group_id: number;
  can_view_medical: number;
  can_view_contacts: number;
  can_edit_students: number;
  can_take_attendance: number;
  group_name?: string;
  group_color?: string;
}

export interface ServiceEventType {
  id: number;
  name: string;
  description?: string;
  base_points: number;
  is_active: number;
  created_at: string;
}

export interface ServiceLog {
  id: number;
  student_id: number;
  event_type_id?: number;
  event_name: string;
  date: string;
  base_points: number;
  leadership_bonus: number;
  reflection_bonus: number;
  bonus_points: number;
  notes?: string;
  logged_by_id?: number;
  logged_by_name?: string;
  created_at: string;
  // joined fields
  first_name?: string;
  last_name?: string;
}

export interface ServiceSummary {
  student_id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_name?: string;
  total_points: number;
  entry_count: number;
  scholarship_label: string;
  scholarship_amount: number;
}

// ─── Service helpers ───────────────────────────────────────────
const SCHOLARSHIP_TIERS = [
  { min: 125, label: 'Full Event', amount: 125 },
  { min: 75,  label: '$75 Credit', amount: 75  },
  { min: 50,  label: '$50 Credit', amount: 50  },
  { min: 25,  label: '$25 Credit', amount: 25  },
];

export function getScholarshipTier(points: number) {
  return SCHOLARSHIP_TIERS.find(t => points >= t.min) ?? null;
}

const ELIGIBLE_GRADES = ['6', '7', '8', '9', '10', '11', '12'];

// ─── Service queries ───────────────────────────────────────────
export function getAllServiceEventTypes() {
  return getDb().prepare(
    'SELECT * FROM service_event_types WHERE is_active = 1 ORDER BY name'
  ).all() as ServiceEventType[];
}

export function logServiceEntry(data: {
  student_id: number;
  event_type_id?: number;
  event_name: string;
  date: string;
  base_points: number;
  leadership_bonus?: number;
  reflection_bonus?: number;
  bonus_points?: number;
  notes?: string;
  logged_by_id?: number;
  logged_by_name?: string;
}) {
  const result = getDb().prepare(`
    INSERT INTO service_logs
      (student_id, event_type_id, event_name, date, base_points,
       leadership_bonus, reflection_bonus, bonus_points, notes, logged_by_id, logged_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.student_id, data.event_type_id ?? null, data.event_name, data.date, data.base_points,
    data.leadership_bonus ? 1 : 0, data.reflection_bonus ? 1 : 0, data.bonus_points ?? 0,
    data.notes ?? null, data.logged_by_id ?? null, data.logged_by_name ?? null
  );
  return result.lastInsertRowid as number;
}

export function getStudentServiceLogs(studentId: number) {
  return getDb().prepare(`
    SELECT sl.*, set2.base_points as event_base_points
    FROM service_logs sl
    LEFT JOIN service_event_types set2 ON set2.id = sl.event_type_id
    WHERE sl.student_id = ?
    ORDER BY sl.date DESC, sl.created_at DESC
  `).all(studentId) as ServiceLog[];
}

export function getStudentServiceTotal(studentId: number): number {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(base_points + (leadership_bonus * 5) + (reflection_bonus * 3) + bonus_points), 0) as total
    FROM service_logs WHERE student_id = ?
  `).get(studentId) as { total: number };
  return row.total;
}

export function deleteServiceLog(id: number) {
  getDb().prepare('DELETE FROM service_logs WHERE id = ?').run(id);
}

export function getAllServiceSummaries(): ServiceSummary[] {
  const rows = getDb().prepare(`
    SELECT
      s.id as student_id, s.first_name, s.last_name, s.grade,
      g.name as group_name,
      COALESCE(SUM(sl.base_points + (sl.leadership_bonus * 5) + (sl.reflection_bonus * 3) + sl.bonus_points), 0) as total_points,
      COUNT(sl.id) as entry_count
    FROM students s
    LEFT JOIN groups g ON g.id = s.group_id
    LEFT JOIN service_logs sl ON sl.student_id = s.id
    WHERE s.is_active = 1 AND s.grade IN (${ELIGIBLE_GRADES.map(() => '?').join(',')})
    GROUP BY s.id
    ORDER BY total_points DESC, s.last_name
  `).all(...ELIGIBLE_GRADES) as (Omit<ServiceSummary, 'scholarship_label' | 'scholarship_amount'> & { total_points: number })[];

  return rows.map(r => {
    const tier = getScholarshipTier(r.total_points);
    return {
      ...r,
      scholarship_label: tier?.label ?? 'None',
      scholarship_amount: tier?.amount ?? 0,
    };
  });
}

export function getRecentServiceLogs(limit = 50) {
  return getDb().prepare(`
    SELECT sl.*, s.first_name, s.last_name
    FROM service_logs sl
    JOIN students s ON s.id = sl.student_id
    ORDER BY sl.date DESC, sl.created_at DESC
    LIMIT ?
  `).all(limit) as ServiceLog[];
}

// ─── App settings (key/value) ──────────────────────────────────
export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb().prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

// ─── Absence follow-up ─────────────────────────────────────────
export interface AbsentStudent {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_name?: string;
  group_color?: string;
  last_seen: string;
  contact_name?: string;
  contact_phone?: string;
}

/** Students who have attended before but not in the last `days` days. */
export function getAbsentStudents(days = 21): AbsentStudent[] {
  return getDb().prepare(`
    SELECT s.id, s.first_name, s.last_name, s.grade,
           g.name as group_name, g.color as group_color,
           MAX(a.date) as last_seen,
           (SELECT c.first_name || ' ' || c.last_name FROM contacts c
             WHERE c.student_id = s.id AND c.phone IS NOT NULL
             ORDER BY c.is_primary DESC LIMIT 1) as contact_name,
           (SELECT c.phone FROM contacts c
             WHERE c.student_id = s.id AND c.phone IS NOT NULL
             ORDER BY c.is_primary DESC LIMIT 1) as contact_phone
    FROM students s
    JOIN attendance a ON a.student_id = s.id AND a.check_in_time IS NOT NULL
    LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.is_active = 1
    GROUP BY s.id
    HAVING MAX(a.date) < date('now', ?)
    ORDER BY last_seen ASC
  `).all(`-${days} days`) as AbsentStudent[];
}

// ─── Kiosk service-point lookup (grades 6-12, minimal fields) ──
export function lookupServicePoints(nameQuery: string) {
  const q = `%${nameQuery.trim().toLowerCase()}%`;
  const students = getDb().prepare(`
    SELECT id, first_name, last_name, grade FROM students
    WHERE is_active = 1 AND grade IN ('6','7','8','9','10','11','12')
      AND LOWER(first_name || ' ' || last_name) LIKE ?
    ORDER BY last_name LIMIT 5
  `).all(q) as { id: number; first_name: string; last_name: string; grade: string }[];

  return students.map(s => {
    const total = getStudentServiceTotal(s.id);
    return {
      first_name: s.first_name,
      last_name: s.last_name,
      grade: s.grade,
      total,
      tier: getScholarshipTier(total),
    };
  });
}

// ─── 90% attendance bonus eligibility ──────────────────────────
const ATTENDANCE_BONUS_EVENT = '90%+ Youth Group Attendance';

export interface BonusCandidate {
  student_id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  attended: number;
  sessions: number;
  rate: number;
  already_awarded: boolean;
}

/** Teens (6-12) whose attendance over the last `weeks` weeks is >= 90% of session dates. */
export function getAttendanceBonusCandidates(weeks = 16): BonusCandidate[] {
  const db = getDb();
  const since = `-${weeks * 7} days`;

  // Session dates = distinct dates where anyone checked in
  const sessionRows = db.prepare(`
    SELECT DISTINCT date FROM attendance
    WHERE check_in_time IS NOT NULL AND date >= date('now', ?)
  `).all(since) as { date: string }[];
  const sessions = sessionRows.length;
  if (sessions < 4) return []; // not enough history to judge fairly

  const rows = db.prepare(`
    SELECT s.id as student_id, s.first_name, s.last_name, s.grade,
           COUNT(DISTINCT a.date) as attended
    FROM students s
    JOIN attendance a ON a.student_id = s.id
      AND a.check_in_time IS NOT NULL AND a.date >= date('now', ?)
    WHERE s.is_active = 1 AND s.grade IN ('6','7','8','9','10','11','12')
    GROUP BY s.id
  `).all(since) as { student_id: number; first_name: string; last_name: string; grade?: string; attended: number }[];

  const yearStart = `${new Date().getFullYear()}-01-01`;
  return rows
    .map(r => {
      const rate = r.attended / sessions;
      const awarded = db.prepare(
        'SELECT id FROM service_logs WHERE student_id = ? AND event_name = ? AND date >= ?'
      ).get(r.student_id, ATTENDANCE_BONUS_EVENT, yearStart);
      return { ...r, sessions, rate, already_awarded: !!awarded };
    })
    .filter(r => r.rate >= 0.9)
    .sort((a, b) => b.rate - a.rate);
}

// ─── Sacrament prep report ─────────────────────────────────────
export interface SacramentPrepRow {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_name?: string;
  sacraments_received?: string;
  sacrament_prep?: string;
  missing: string[];
}

/**
 * Flags students missing sacraments typically received by their grade:
 *  - Baptism: everyone
 *  - Reconciliation & First Communion: grade 2 and up
 *  - Confirmation: grade 9 and up
 */
export function getSacramentPrepReport(): SacramentPrepRow[] {
  const rows = getDb().prepare(`
    SELECT s.id, s.first_name, s.last_name, s.grade, s.sacraments_received, s.sacrament_prep,
           g.name as group_name
    FROM students s LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.is_active = 1 AND s.grade IS NOT NULL AND s.grade != ''
    ORDER BY s.grade, s.last_name
  `).all() as (Omit<SacramentPrepRow, 'missing'>)[];

  return rows.map(r => {
    const have = (r.sacraments_received || '').toLowerCase();
    const gradeNum = r.grade === 'K' ? 0 : parseInt(r.grade || '0', 10) || 0;
    const missing: string[] = [];
    if (!have.includes('baptism')) missing.push('Baptism');
    if (gradeNum >= 2) {
      if (!have.includes('reconciliation')) missing.push('Reconciliation');
      if (!have.includes('first communion')) missing.push('First Communion');
    }
    if (gradeNum >= 9 && !have.includes('confirmation')) missing.push('Confirmation');
    return { ...r, missing };
  }).filter(r => r.missing.length > 0);
}

// ─── Sacramental prep attendance alerts ────────────────────────
export interface PrepAlert {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_name?: string;
  sacrament_prep: string;
  attended: number;
  sessions: number;
  missed_pct: number;
  contact_name?: string;
  contact_phone?: string;
}

/** Start of the current school year (Aug 1). */
function schoolYearStart(): string {
  const now = new Date();
  const year = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-08-01`;
}

/**
 * Students enrolled in sacramental prep who have missed more than 75% of
 * their group's class sessions this school year. A "session" is any date
 * where someone in the same group checked in (or any check-in date at all,
 * for students without a group). Needs at least 4 sessions to flag anyone.
 */
export function getSacramentPrepAlerts(): PrepAlert[] {
  const db = getDb();
  const since = schoolYearStart();

  const prepStudents = db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.grade, s.group_id, s.sacrament_prep,
           g.name as group_name,
           (SELECT c.first_name || ' ' || c.last_name FROM contacts c
             WHERE c.student_id = s.id AND c.phone IS NOT NULL
             ORDER BY c.is_primary DESC LIMIT 1) as contact_name,
           (SELECT c.phone FROM contacts c
             WHERE c.student_id = s.id AND c.phone IS NOT NULL
             ORDER BY c.is_primary DESC LIMIT 1) as contact_phone
    FROM students s LEFT JOIN groups g ON g.id = s.group_id
    WHERE s.is_active = 1 AND s.sacrament_prep IS NOT NULL AND s.sacrament_prep != ''
  `).all() as (Omit<PrepAlert, 'attended' | 'sessions' | 'missed_pct'> & { group_id?: number })[];

  const alerts: PrepAlert[] = [];
  for (const s of prepStudents) {
    // Class sessions = distinct dates their group met this school year
    const sessions = (s.group_id
      ? db.prepare(`
          SELECT COUNT(DISTINCT a.date) as n FROM attendance a
          JOIN students st ON st.id = a.student_id
          WHERE a.check_in_time IS NOT NULL AND a.date >= ? AND st.group_id = ?
        `).get(since, s.group_id)
      : db.prepare(`
          SELECT COUNT(DISTINCT date) as n FROM attendance
          WHERE check_in_time IS NOT NULL AND date >= ?
        `).get(since)) as { n: number };

    if (sessions.n < 4) continue; // not enough class history to judge

    const attended = (db.prepare(`
      SELECT COUNT(DISTINCT date) as n FROM attendance
      WHERE student_id = ? AND check_in_time IS NOT NULL AND date >= ?
    `).get(s.id, since) as { n: number }).n;

    const missedPct = 1 - attended / sessions.n;
    if (missedPct > 0.75) {
      alerts.push({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        grade: s.grade,
        group_name: s.group_name,
        sacrament_prep: s.sacrament_prep,
        attended,
        sessions: sessions.n,
        missed_pct: Math.round(missedPct * 100),
        contact_name: s.contact_name,
        contact_phone: s.contact_phone,
      });
    }
  }
  return alerts.sort((a, b) => b.missed_pct - a.missed_pct);
}

// ─── Weekly summary data ───────────────────────────────────────
export function getWeeklySummaryData() {
  const db = getDb();
  const attendance = db.prepare(`
    SELECT date, COUNT(*) as count FROM attendance
    WHERE check_in_time IS NOT NULL AND date >= date('now', '-7 days')
    GROUP BY date ORDER BY date
  `).all() as { date: string; count: number }[];

  const newStudents = db.prepare(`
    SELECT first_name, last_name FROM students
    WHERE is_active = 1 AND enrolled_date >= date('now', '-7 days')
  `).all() as { first_name: string; last_name: string }[];

  const newGuests = db.prepare(`
    SELECT first_name, last_name, visit_count FROM guests
    WHERE created_at >= datetime('now', '-7 days')
  `).all() as { first_name: string; last_name: string; visit_count: number }[];

  const birthdays = db.prepare(`
    SELECT first_name, last_name, date_of_birth FROM students
    WHERE is_active = 1 AND date_of_birth IS NOT NULL
      AND strftime('%m-%d', date_of_birth) BETWEEN strftime('%m-%d', 'now') AND strftime('%m-%d', 'now', '+7 days')
  `).all() as { first_name: string; last_name: string; date_of_birth: string }[];

  return {
    attendance, newStudents, newGuests, birthdays,
    absent: getAbsentStudents(21),
    prepAlerts: getSacramentPrepAlerts(),
  };
}
