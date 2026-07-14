'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { Download, BarChart3, Search, Printer, Church } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ReportRow {
  student_id: number;
  first_name: string;
  last_name: string;
  group_name: string;
  count: number;
  total_sessions: number;
  rate: number;
}

interface Group {
  id: number;
  name: string;
  color: string;
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then(g => setGroups(Array.isArray(g) ? g : []));
  }, []);

  async function loadReport() {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      if (groupId) params.set('group_id', groupId);
      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();
      setData(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams({ start: startDate, end: endDate, format: 'csv' });
    if (groupId) params.set('group_id', groupId);
    window.location.href = `/api/reports?${params}`;
  }

  const filtered = data.filter(r => {
    if (!search) return true;
    const name = `${r.first_name} ${r.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const totalSessions = data[0]?.total_sessions ?? 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-medium text-gray-900 flex items-center gap-2">
              <BarChart3 size={24} className="text-primary-500" /> Attendance Reports
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Per-student attendance statistics for any date range</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/print?type=roster" className="btn-outlined flex items-center gap-2 text-sm px-4 py-2">
              <Printer size={16} /> Print Roster
            </Link>
            <Link href="/print?type=signin" className="btn-outlined flex items-center gap-2 text-sm px-4 py-2">
              <Printer size={16} /> Sign-In Sheet
            </Link>
            <Link href="/reports/sacraments" className="btn-outlined flex items-center gap-2 text-sm px-4 py-2">
              <Church size={16} /> Sacrament Prep
            </Link>
            {data.length > 0 && (
              <button onClick={exportCsv} className="btn-outlined flex items-center gap-2 text-sm px-4 py-2">
                <Download size={16} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="card p-5">
          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="field-outlined w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="field-outlined w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Group</label>
              <select
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="field-outlined w-full"
              >
                <option value="">All Groups</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadReport}
                disabled={loading}
                className="btn-filled w-full py-2.5 text-sm"
              >
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        {searched && data.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-medium text-gray-900">{data.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Students</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-medium text-gray-900">{totalSessions}</p>
              <p className="text-xs text-gray-500 mt-0.5">Session Days</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-medium text-gray-900">
                {data.length > 0 ? Math.round(data.reduce((s, r) => s + r.rate, 0) / data.length) : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Avg. Attendance</p>
            </div>
          </div>
        )}

        {/* Table */}
        {searched && (
          <div className="card overflow-hidden">
            {data.length > 0 && (
              <div className="px-5 py-3 border-b border-outline-variant/40">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter by name..."
                    className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-full sm:w-64 outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <BarChart3 size={36} className="mx-auto mb-3 opacity-30" />
                {data.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-gray-500">No attendance in this date range</p>
                    <p className="text-xs mt-1">Try widening the dates above — or if you&apos;re just getting started, check students in on the Attendance page first</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">No students match your search</p>
                    <p className="text-xs mt-1">Try a different name or group</p>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attended</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(r => (
                      <tr key={r.student_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.group_name}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">{r.count}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{r.total_sessions}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  r.rate >= 80 ? 'bg-green-500' :
                                  r.rate >= 50 ? 'bg-amber-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${r.rate}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium w-10 text-right flex-shrink-0 ${
                              r.rate >= 80 ? 'text-green-600' :
                              r.rate >= 50 ? 'text-amber-600' : 'text-red-500'
                            }`}>{r.rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!searched && (
          <div className="card py-16 text-center text-gray-400">
            <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a date range and click Generate Report</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
