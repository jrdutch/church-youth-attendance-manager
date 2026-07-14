'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { Church, ArrowLeft, Printer } from 'lucide-react';
import { ListSkeleton } from '@/components/Skeleton';

interface Row {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_name?: string;
  sacraments_received?: string;
  sacrament_prep?: string;
  missing: string[];
}

const SACRAMENT_COLORS: Record<string, string> = {
  'Baptism': 'bg-sky-100 text-sky-700 border-sky-200',
  'Reconciliation': 'bg-violet-100 text-violet-700 border-violet-200',
  'First Communion': 'bg-amber-100 text-amber-700 border-amber-200',
  'Confirmation': 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function SacramentPrepPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/reports/sacraments')
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const sacraments = ['Baptism', 'Reconciliation', 'First Communion', 'Confirmation'];
  const filtered = filter === 'all' ? rows : rows.filter(r => r.missing.includes(filter));

  const counts = sacraments.map(s => ({ name: s, count: rows.filter(r => r.missing.includes(s)).length }));

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/reports" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-1">
              <ArrowLeft size={14} /> Reports
            </Link>
            <h1 className="text-2xl font-medium text-gray-900 flex items-center gap-2">
              <Church size={24} className="text-primary-500" /> Sacrament Preparation
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Students who may still need a sacrament typical for their grade
            </p>
          </div>
          <button onClick={() => window.print()} className="btn-outlined text-sm print:hidden">
            <Printer size={15} /> Print
          </button>
        </div>

        {/* Guideline note */}
        <div className="card p-4 text-xs text-gray-500 print:hidden">
          Based on common practice: <strong>Baptism</strong> for all ages ·{' '}
          <strong>Reconciliation &amp; First Communion</strong> from 2nd grade ·{' '}
          <strong>Confirmation</strong> from 9th grade. Update a student&apos;s profile
          when a sacrament is received and they&apos;ll drop off this list.
        </div>

        {/* Summary chips / filters */}
        <div className="flex gap-2 flex-wrap print:hidden">
          <button onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${filter === 'all' ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
            All ({rows.length})
          </button>
          {counts.filter(c => c.count > 0).map(c => (
            <button key={c.name} onClick={() => setFilter(c.name)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${filter === c.name ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
              Needs {c.name} ({c.count})
            </button>
          ))}
        </div>

        {loading ? (
          <ListSkeleton rows={6} />
        ) : filtered.length === 0 ? (
          <div className="card py-16 text-center">
            <Church size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {rows.length === 0 ? 'Everyone is up to date!' : 'No students match this filter'}
            </p>
            {rows.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                No students appear to be missing sacraments expected for their grade
              </p>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Grade</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Still Needs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/students/${r.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                        {r.first_name} {r.last_name}
                      </Link>
                      {r.group_name && <span className="text-xs text-gray-400 ml-2">{r.group_name}</span>}
                      {r.sacrament_prep && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                          ✝ In {r.sacrament_prep} Prep
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{r.grade === 'K' ? 'K' : r.grade}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {r.missing.map(m => (
                          <span key={m} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${SACRAMENT_COLORS[m]}`}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
