'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import AppShell from '@/components/AppShell';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { toast } from '@/components/Toast';
import { ListSkeleton } from '@/components/Skeleton';
import { UserPlus, Search, Filter, ChevronRight, Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_id?: number;
  group_name?: string;
  group_color?: string;
  photo_url?: string;
  date_of_birth?: string;
}

interface Group {
  id: number;
  name: string;
  color: string;
  type: string;
}

// Fields users can map spreadsheet columns to
type FieldKey = 'first_name' | 'last_name' | 'date_of_birth' | 'grade' | 'group_name' | 'notes';

interface StudentField {
  key: FieldKey;
  label: string;
  required?: boolean;
}

const STUDENT_FIELDS: StudentField[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'grade', label: 'Grade' },
  { key: 'group_name', label: 'Group' },
  { key: 'notes', label: 'Notes' },
];

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | ''>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '',
    grade: '', group_id: '', photo_url: '', notes: '',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/students').then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
    ]).then(([s, g]) => {
      setStudents(Array.isArray(s) ? s : []);
      setGroups(Array.isArray(g) ? g : []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchGroup = !filterGroup || s.group_id === Number(filterGroup);
    return matchSearch && matchGroup;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        group_id: form.group_id ? Number(form.group_id) : undefined,
      }),
    });
    if (res.ok) {
      const { id } = await res.json();
      const group = groups.find(g => g.id === Number(form.group_id));
      setStudents(prev => [...prev, {
        id,
        first_name: form.first_name,
        last_name: form.last_name,
        grade: form.grade,
        group_id: form.group_id ? Number(form.group_id) : undefined,
        group_name: group?.name,
        group_color: group?.color,
        photo_url: form.photo_url || undefined,
        date_of_birth: form.date_of_birth || undefined,
      }]);
      setShowAddModal(false);
      setForm({ first_name: '', last_name: '', date_of_birth: '', grade: '', group_id: '', photo_url: '', notes: '' });
      toast.success('Student added');
    } else {
      toast.error('Could not add student — please try again');
    }
    setSaving(false);
  }

  function handleImportDone(added: number) {
    setShowImportModal(false);
    // Reload student list
    fetch('/api/students').then(r => r.json()).then(s => {
      setStudents(Array.isArray(s) ? s : []);
    });
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImportModal(true)} className="btn-outlined">
              <Upload size={15} /> Import Excel
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-filled">
              <UserPlus size={15} /> Add Student
            </button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students..."
              className="field-outlined !pl-9"
            />
          </div>
          <div className="relative">
            <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value === '' ? '' : Number(e.target.value))}
              className="field-outlined !pl-9 !pr-8 appearance-none bg-white"
            >
              <option value="">All Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <ListSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <div className="card py-16 text-center">
            {search || filterGroup ? (
              <>
                <Search size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No students match your search</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name, or clear the group filter above</p>
              </>
            ) : (
              <>
                <UserPlus size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">No students yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-5">
                  Import your registration list from Flocknote, or add students one at a time
                </p>
                <div className="flex gap-3 justify-center">
                  <Link href="/admin/import" className="btn-outlined text-sm">Import from CSV</Link>
                  <button onClick={() => setShowAddModal(true)} className="btn-filled text-sm">
                    <UserPlus size={15} /> Add a Student
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="card divide-y divide-outline-variant/30 overflow-hidden">
            {filtered.map(s => (
              <Link
                key={s.id}
                href={`/students/${s.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <Avatar
                  name={`${s.first_name} ${s.last_name}`}
                  photoUrl={s.photo_url}
                  size="md"
                  color={s.group_color}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {s.grade ? `Grade ${s.grade}` : 'No grade'}
                    {s.date_of_birth && ` · DOB: ${new Date(s.date_of_birth + 'T00:00:00').toLocaleDateString()}`}
                  </p>
                </div>
                {s.group_name && <Badge label={s.group_name} color={s.group_color} />}
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 text-right">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {showAddModal && (
        <Modal title="Add Student" onClose={() => setShowAddModal(false)} size="lg">
          <StudentForm
            form={form}
            setForm={setForm}
            groups={groups}
            onSubmit={handleAdd}
            saving={saving}
            onCancel={() => setShowAddModal(false)}
          />
        </Modal>
      )}

      {showImportModal && (
        <Modal title="Import Students from Excel" onClose={() => setShowImportModal(false)} size="xl">
          <ImportModal groups={groups} onDone={handleImportDone} onCancel={() => setShowImportModal(false)} />
        </Modal>
      )}
    </AppShell>
  );
}

// ─── Import Modal ───────────────────────────────────────────────

type ImportStep = 'upload' | 'map' | 'preview' | 'done';

interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

function ImportModal({ groups, onDone, onCancel }: {
  groups: Group[];
  onDone: (added: number) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, FieldKey | ''>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ added: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        if (jsonData.length === 0) return;

        const headers = Object.keys(jsonData[0]);
        const rows = jsonData.map(r =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')]))
        );

        // Auto-map columns by guessing from header names
        const autoMap: Record<string, FieldKey | ''> = {};
        for (const h of headers) {
          const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lower.includes('first') || lower === 'firstname') autoMap[h] = 'first_name';
          else if (lower.includes('last') || lower === 'lastname') autoMap[h] = 'last_name';
          else if (lower.includes('birth') || lower.includes('dob')) autoMap[h] = 'date_of_birth';
          else if (lower.includes('grade')) autoMap[h] = 'grade';
          else if (lower.includes('group') || lower.includes('ministry') || lower.includes('class')) autoMap[h] = 'group_name';
          else if (lower.includes('note')) autoMap[h] = 'notes';
          else autoMap[h] = '';
        }

        setSheet({ headers, rows });
        setMapping(autoMap);
        setStep('map');
      } catch {
        toast.error('Could not read file. Please use a valid .xlsx, .xls, or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  // Build mapped rows from the sheet + current column mapping
  function getMappedRows() {
    if (!sheet) return [];
    return sheet.rows.map(row => {
      const out: Record<string, string> = {};
      for (const [col, field] of Object.entries(mapping)) {
        if (field && row[col] !== undefined) {
          out[field] = row[col];
        }
      }
      return out;
    }).filter(r => r.first_name || r.last_name);
  }

  async function handleImport() {
    const rows = getMappedRows();
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResult(data);
      setStep('done');
    } catch {
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  const mappedRows = sheet ? getMappedRows() : [];
  const hasBothNames = STUDENT_FIELDS.filter(f => f.required).every(f =>
    Object.values(mapping).includes(f.key)
  );

  // ── Step: Upload ────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Upload an Excel (.xlsx, .xls) or CSV file. The file should have column headers in the first row.
        </p>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
        >
          <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-700">Drop your spreadsheet here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          <p className="text-xs text-gray-400 mt-3">.xlsx · .xls · .csv</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700 space-y-1">
          <p className="font-medium">Tips for best results:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600">
            <li>Include column headers like <em>First Name</em>, <em>Last Name</em>, <em>Grade</em>, <em>Date of Birth</em></li>
            <li>Group names should match exactly: <strong>{groups.map(g => g.name).join(', ')}</strong></li>
            <li>Dates can be MM/DD/YYYY or YYYY-MM-DD format</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="btn-outlined flex-1">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Map columns ──────────────────────────────────────
  if (step === 'map' && sheet) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Found <strong>{sheet.headers.length}</strong> columns and <strong>{sheet.rows.length}</strong> rows.
            Map each column to a student field.
          </p>
          <button onClick={() => { setSheet(null); setStep('upload'); }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={12} /> Change file
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Spreadsheet Column</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Sample Data</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Maps To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sheet.headers.map(h => (
                <tr key={h} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{h}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs max-w-32 truncate">
                    {sheet.rows.slice(0, 3).map(r => r[h]).filter(Boolean).join(', ')}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={mapping[h] ?? ''}
                      onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value as FieldKey | '' }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">— Skip —</option>
                      {STUDENT_FIELDS.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!hasBothNames && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ You must map at least <strong>First Name</strong> and <strong>Last Name</strong> to continue.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="btn-outlined flex-1">
            Cancel
          </button>
          <button
            onClick={() => setStep('preview')}
            disabled={!hasBothNames}
            className="btn-filled flex-1"
          >
            Preview ({mappedRows.length} students)
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Preview ──────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Review the students below before importing. <strong>{mappedRows.length}</strong> students will be added.
        </p>

        <div className="border border-gray-200 rounded-lg overflow-auto max-h-72">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {STUDENT_FIELDS.filter(f => Object.values(mapping).includes(f.key)).map(f => (
                  <th key={f.key} className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mappedRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {STUDENT_FIELDS.filter(f => Object.values(mapping).includes(f.key)).map(f => (
                    <td key={f.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {row[f.key] || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep('map')}
            className="btn-outlined flex-1">
            ← Back
          </button>
          <button
            onClick={handleImport}
            disabled={importing || mappedRows.length === 0}
            className="btn-filled flex-1"
          >
            {importing ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing...</>
            ) : (
              <>Import {mappedRows.length} Students</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Done ─────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div className="space-y-5">
        <div className="text-center py-4">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <p className="text-xl font-bold text-gray-900">{result.added} student{result.added !== 1 ? 's' : ''} imported!</p>
          {result.errors.length > 0 && (
            <p className="text-sm text-amber-600 mt-1">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped</p>
          )}
        </div>

        {result.errors.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-1 max-h-40 overflow-auto">
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
              <AlertCircle size={13} /> Skipped rows:
            </p>
            {result.errors.map((err, i) => (
              <p key={i} className="text-xs text-amber-600">{err}</p>
            ))}
          </div>
        )}

        <button
          onClick={() => onDone(result.added)}
          className="btn-filled w-full"
        >
          Done
        </button>
      </div>
    );
  }

  return null;
}

// ─── Add Student Form ───────────────────────────────────────────

type StudentFormData = {
  first_name: string; last_name: string; date_of_birth: string;
  grade: string; group_id: string; photo_url: string; notes: string;
};

function StudentForm({ form, setForm, groups, onSubmit, saving, onCancel }: {
  form: StudentFormData;
  setForm: React.Dispatch<React.SetStateAction<StudentFormData>>;
  groups: Group[];
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const field = (key: keyof StudentFormData, label: string, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        required={required}
        className="field-outlined"
      />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {field('first_name', 'First Name', 'text', true)}
        {field('last_name', 'Last Name', 'text', true)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {field('date_of_birth', 'Date of Birth', 'date')}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
          <select
            value={form.grade}
            onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}
            className="field-outlined bg-white cursor-pointer"
          >
            <option value="">Select grade</option>
            {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
              <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ministry Group</label>
        <select
          value={form.group_id}
          onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}
          className="field-outlined bg-white cursor-pointer"
        >
          <option value="">No group</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      {field('photo_url', 'Photo URL (optional)')}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          rows={2}
          className="field-outlined resize-none"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-outlined flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn-filled flex-1">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
          {saving ? 'Saving…' : 'Add Student'}
        </button>
      </div>
    </form>
  );
}
