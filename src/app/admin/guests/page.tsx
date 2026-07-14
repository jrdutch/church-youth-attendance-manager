'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { UserPlus, Phone, RefreshCw, CheckCircle, Star } from 'lucide-react';
import Link from 'next/link';

interface Guest {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  visit_count: number;
  converted_student_id?: number;
  student_first?: string;
  student_last?: string;
  last_visit?: string;
  created_at: string;
}

export default function AdminGuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/guests');
      const data = await res.json();
      setGuests(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const converted = guests.filter(g => g.converted_student_id);
  const active = guests.filter(g => !g.converted_student_id);

  return (
    <AppShell>
      <div className="space-y-5 max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Guest Check-Ins</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Guests auto-enroll as new students after {3} visits
            </p>
          </div>
          <button onClick={load} className="btn-icon text-gray-400 hover:text-primary-600" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-sm font-medium border border-teal-200">
            <UserPlus size={15} />
            {active.length} active guest{active.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
            <Star size={15} />
            {converted.length} converted to student{converted.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
          </div>
        ) : guests.length === 0 ? (
          <div className="card py-14 text-center">
            <UserPlus size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No guest check-ins yet</p>
            <p className="text-sm text-gray-400 mt-1">Guests appear here after checking in on the kiosk</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guests.map(g => {
              const isConverted = !!g.converted_student_id;
              const progressPct = Math.min((g.visit_count / 3) * 100, 100);

              return (
                <div key={g.id} className={`card p-5 ${isConverted ? 'border border-amber-200 bg-amber-50/30' : ''}`}>
                  <div className="flex items-start gap-4">

                    {/* Avatar-style icon */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold
                      ${isConverted ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
                      {g.first_name[0]}{g.last_name[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{g.first_name} {g.last_name}</p>
                        {isConverted && (
                          <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
                            <CheckCircle size={11} /> Enrolled
                          </span>
                        )}
                        {!isConverted && g.visit_count >= 3 && (
                          <span className="text-xs bg-teal-100 text-teal-700 px-2.5 py-0.5 rounded-full">
                            Ready to enroll
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone size={12} className="text-gray-400" />
                        <a href={`tel:${g.phone}`} className="text-sm text-gray-600 hover:text-primary-600">
                          {g.phone}
                        </a>
                      </div>

                      {/* Visit count + progress bar */}
                      {!isConverted && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">
                              {g.visit_count} visit{g.visit_count !== 1 ? 's' : ''} · {Math.max(0, 4 - g.visit_count)} until enrollment
                            </span>
                            <span className="text-xs text-gray-400">
                              {g.last_visit ? `Last: ${new Date(g.last_visit + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-teal-500 transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Converted: link to student profile */}
                      {isConverted && g.converted_student_id && (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-sm text-gray-500">
                            Enrolled as{' '}
                            <Link href={`/students/${g.converted_student_id}`}
                              className="text-primary-600 hover:text-primary-700 font-medium">
                              {g.student_first} {g.student_last}
                            </Link>
                          </p>
                        </div>
                      )}

                      {isConverted && g.last_visit && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last visit: {new Date(g.last_visit + 'T00:00:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>

                    {/* Visit badge */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex flex-col items-center justify-center
                      ${isConverted ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      <span className="text-lg font-bold leading-none">{g.visit_count}</span>
                      <span className="text-[9px] uppercase tracking-wide">visits</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
