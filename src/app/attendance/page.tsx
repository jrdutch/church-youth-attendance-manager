'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import { toast } from '@/components/Toast';
import { PanelsSkeleton } from '@/components/Skeleton';
import { CalendarCheck, CheckCircle, Clock, LogOut, Filter } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

interface AttendanceRecord {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  photo_url?: string;
  group_name?: string;
  group_color?: string;
  check_in_time?: string;
  check_out_time?: string;
  checked_in_by_name?: string;
  picked_up_by?: string;
}

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  photo_url?: string;
  group_id?: number;
  group_name?: string;
  group_color?: string;
}

interface Group {
  id: number;
  name: string;
  color: string;
}

export default function AttendancePage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then(g => setGroups(Array.isArray(g) ? g : []));
    fetch('/api/students').then(r => r.json()).then(s => setStudents(Array.isArray(s) ? s : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = `/api/attendance?date=${date}${filterGroup ? `&group_id=${filterGroup}` : ''}`;
    fetch(url).then(r => r.json()).then(data => {
      setRecords(Array.isArray(data) ? data : []);
    }).finally(() => setLoading(false));
  }, [date, filterGroup]);

  const checkedInIds = new Set(records.map(r => r.student_id));
  const visibleStudents = students.filter(s => !filterGroup || s.group_id === Number(filterGroup));
  const notCheckedIn = visibleStudents.filter(s => !checkedInIds.has(s.id));
  const present = records.filter(r => r.check_in_time && !r.check_out_time);
  const checkedOut = records.filter(r => r.check_out_time);

  async function checkIn(studentId: number) {
    setProcessing(studentId);
    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, date }),
      });
      if (!res.ok) throw new Error();
      const updated = await fetch(`/api/attendance?date=${date}${filterGroup ? `&group_id=${filterGroup}` : ''}`).then(r => r.json());
      setRecords(Array.isArray(updated) ? updated : []);
    } catch {
      toast.error('Check-in did not save — please try again');
    } finally {
      setProcessing(null);
    }
  }

  async function checkOut(studentId: number) {
    setProcessing(studentId);
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, date }),
      });
      if (!res.ok) throw new Error();
      setRecords(prev => prev.map(r =>
        r.student_id === studentId ? { ...r, check_out_time: new Date().toISOString() } : r
      ));
    } catch {
      toast.error('Check-out did not save — please try again');
    } finally {
      setProcessing(null);
    }
  }

  const statChips = [
    { label: 'Present',     count: present.length,       color: '#16a34a' },
    { label: 'Checked Out', count: checkedOut.length,    color: '#d97706' },
    { label: 'Not Arrived', count: notCheckedIn.length,  color: '#6b7280' },
  ];

  return (
    <AppShell>
      <div className="space-y-5">

        {/* ── Top bar ── */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-2xl font-medium text-gray-900">Attendance</h1>

          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate(format(subDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
              className="btn-icon border-2 border-outline-variant text-gray-600 w-10 h-10"
            >‹</button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="field-outlined py-2 text-sm w-auto"
            />
            <button
              onClick={() => setDate(format(addDays(new Date(date + 'T00:00:00'), 1), 'yyyy-MM-dd'))}
              className="btn-icon border-2 border-outline-variant text-gray-600 w-10 h-10"
            >›</button>
          </div>

          {/* Group filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value === '' ? '' : Number(e.target.value))}
              className="field-outlined pl-9 py-2 text-sm appearance-none bg-white cursor-pointer w-auto"
            >
              <option value="">All Groups</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {/* ── Stat chips ── */}
        <div className="grid grid-cols-3 gap-3">
          {statChips.map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-3xl font-medium" style={{ color: s.color }}>{s.count}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <PanelsSkeleton />
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Present */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-outline-variant/40 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <h2 className="font-medium text-gray-900 text-sm">Present ({present.length})</h2>
              </div>
              <div className="divide-y divide-outline-variant/30 max-h-96 overflow-y-auto">
                {present.length === 0
                  ? <p className="py-8 text-center text-sm text-gray-400">No one checked in yet</p>
                  : present.map(r => (
                    <AttendanceRow
                      key={r.id}
                      record={r}
                      action="checkout"
                      processing={processing === r.student_id}
                      onAction={() => checkOut(r.student_id)}
                    />
                  ))}
              </div>
            </div>

            {/* Not arrived */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-outline-variant/40 flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <h2 className="font-medium text-gray-900 text-sm">Not Arrived ({notCheckedIn.length})</h2>
              </div>
              <div className="divide-y divide-outline-variant/30 max-h-96 overflow-y-auto">
                {notCheckedIn.length === 0
                  ? <p className="py-8 text-center text-sm text-gray-400">Everyone is checked in!</p>
                  : notCheckedIn.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={`${s.first_name} ${s.last_name}`} photoUrl={s.photo_url} size="sm" color={s.group_color} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.first_name} {s.last_name}</p>
                        {s.group_name && <Badge label={s.group_name} color={s.group_color} />}
                      </div>
                      <button
                        onClick={() => checkIn(s.id)}
                        disabled={processing === s.id}
                        className="btn-filled px-4 py-1.5 text-xs"
                      >
                        {processing === s.id
                          ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <CalendarCheck size={13} />}
                        Check In
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Checked out */}
            {checkedOut.length > 0 && (
              <div className="card overflow-hidden lg:col-span-2">
                <div className="px-5 py-3.5 border-b border-outline-variant/40 flex items-center gap-2">
                  <LogOut size={16} className="text-amber-500" />
                  <h2 className="font-medium text-gray-900 text-sm">Checked Out ({checkedOut.length})</h2>
                </div>
                <div className="divide-y divide-outline-variant/30">
                  {checkedOut.map(r => (
                    <AttendanceRow key={r.id} record={r} action="none" processing={false} onAction={() => {}} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AttendanceRow({ record, action, processing, onAction }: {
  record: AttendanceRecord;
  action: 'checkout' | 'none';
  processing: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Avatar name={`${record.first_name} ${record.last_name}`} photoUrl={record.photo_url} size="sm" color={record.group_color} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {record.first_name} {record.last_name}
        </p>
        <p className="text-xs text-gray-400">
          In: {record.check_in_time
            ? new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—'}
          {record.check_out_time && ` · Out: ${new Date(record.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </p>
        {record.picked_up_by && (
          <p className="text-xs text-emerald-600 font-medium">
            Picked up by {record.picked_up_by}
          </p>
        )}
      </div>
      {record.group_name && <Badge label={record.group_name} color={record.group_color} />}
      {action === 'checkout' && (
        <button
          onClick={onAction}
          disabled={processing}
          className="btn-outlined border-amber-400 text-amber-600 hover:bg-amber-50 px-3 py-1.5 text-xs"
        >
          {processing
            ? <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            : <LogOut size={12} />}
          Check Out
        </button>
      )}
      {action === 'none' && record.check_out_time && (
        <span className="text-xs text-gray-400 bg-surface-container px-3 py-1 rounded-full">Done</span>
      )}
    </div>
  );
}
