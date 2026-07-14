'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_id?: number;
  group_name?: string;
}
interface Group { id: number; name: string; }

function PrintSheet() {
  const params = useSearchParams();
  const initialType = params.get('type') === 'signin' ? 'signin' : 'roster';
  const initialGroup = params.get('group') || '';

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [type, setType] = useState<'roster' | 'signin'>(initialType);
  const [groupId, setGroupId] = useState(initialGroup);
  const [contacts, setContacts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/students').then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
    ]).then(([s, g]) => {
      setStudents(Array.isArray(s) ? s : []);
      setGroups(Array.isArray(g) ? g : []);
    }).finally(() => setLoading(false));
  }, []);

  // Load emergency phone numbers for the roster variant
  useEffect(() => {
    if (type !== 'roster' || students.length === 0) return;
    let cancelled = false;
    (async () => {
      const map: Record<number, string> = {};
      const visible = students.filter(s => !groupId || s.group_id === Number(groupId));
      await Promise.all(visible.map(async s => {
        try {
          const res = await fetch(`/api/students/${s.id}/contacts`);
          if (res.ok) {
            const list = await res.json();
            const c = Array.isArray(list) ? list.find((x: { phone?: string }) => x.phone) : null;
            if (c) map[s.id] = `${c.first_name} ${c.last_name} · ${c.phone}`;
          }
        } catch { /* leave blank */ }
      }));
      if (!cancelled) setContacts(map);
    })();
    return () => { cancelled = true; };
  }, [type, students, groupId]);

  const visible = students
    .filter(s => !groupId || s.group_id === Number(groupId))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  const groupName = groupId ? groups.find(g => g.id === Number(groupId))?.name : 'All Groups';
  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Controls — hidden when printing */}
      <div className="print:hidden bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <select value={type} onChange={e => setType(e.target.value as 'roster' | 'signin')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="roster">Roster (with contacts)</option>
          <option value="signin">Blank Sign-In Sheet</option>
        </select>
        <select value={groupId} onChange={e => setGroupId(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={() => window.print()} className="btn-filled ml-auto">
          <Printer size={16} /> Print
        </button>
      </div>

      {/* Printable content */}
      <div className="max-w-3xl mx-auto px-8 py-8">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : (
          <>
            <div className="mb-6 border-b-2 border-gray-800 pb-3">
              <h1 className="text-2xl font-bold">
                {type === 'roster' ? 'Student Roster' : 'Attendance Sign-In Sheet'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {groupName} · {visible.length} students
                {type === 'signin' ? ` · Date: ${today}` : ` · Printed ${today}`}
              </p>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800 text-left">
                  <th className="py-2 pr-3 w-8">#</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4 w-16">Grade</th>
                  {type === 'roster' ? (
                    <th className="py-2">Emergency Contact</th>
                  ) : (
                    <>
                      <th className="py-2 pr-4 w-28">Time In</th>
                      <th className="py-2 pr-4 w-28">Time Out</th>
                      <th className="py-2">Picked Up By</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-300">
                    <td className="py-2.5 pr-3 text-gray-400">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium">{s.last_name}, {s.first_name}</td>
                    <td className="py-2.5 pr-4">{s.grade === 'K' ? 'K' : s.grade || '—'}</td>
                    {type === 'roster' ? (
                      <td className="py-2.5 text-gray-700">{contacts[s.id] || '—'}</td>
                    ) : (
                      <>
                        <td className="py-2.5 pr-4 border-l border-gray-200 pl-2">&nbsp;</td>
                        <td className="py-2.5 pr-4 border-l border-gray-200 pl-2">&nbsp;</td>
                        <td className="py-2.5 border-l border-gray-200 pl-2">&nbsp;</td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Extra blank rows on sign-in sheets for guests */}
                {type === 'signin' && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`blank-${i}`} className="border-b border-gray-300">
                    <td className="py-2.5 pr-3 text-gray-400">{visible.length + i + 1}</td>
                    <td className="py-2.5 pr-4 text-gray-300 italic">Guest</td>
                    <td className="py-2.5 pr-4">&nbsp;</td>
                    <td className="py-2.5 pr-4 border-l border-gray-200 pl-2">&nbsp;</td>
                    <td className="py-2.5 pr-4 border-l border-gray-200 pl-2">&nbsp;</td>
                    <td className="py-2.5 border-l border-gray-200 pl-2">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {type === 'signin' && (
              <p className="text-xs text-gray-500 mt-6">
                Leader signature: ______________________________ &nbsp;&nbsp;
                Enter these into the app later from the Attendance page.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintSheet />
    </Suspense>
  );
}
