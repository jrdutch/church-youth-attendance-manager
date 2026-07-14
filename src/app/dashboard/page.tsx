'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Badge from '@/components/Badge';
import Avatar from '@/components/Avatar';
import { StatCardsSkeleton, PanelsSkeleton, ListSkeleton } from '@/components/Skeleton';
import {
  Users, CalendarCheck, TrendingUp, Clock, Cake, BarChart2,
  CheckCircle2, Circle, X, Rocket, ArrowRight, Monitor, HeartHandshake, Phone
} from 'lucide-react';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: number;
  first_name: string;
  last_name: string;
  photo_url?: string;
  group_name?: string;
  group_color?: string;
  check_in_time: string;
  check_out_time?: string;
}

interface Group {
  id: number;
  name: string;
  color: string;
  parent_id?: number;
}

interface BirthdayStudent {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  group_name?: string;
  group_color?: string;
}

interface TrendEntry {
  week: string;
  count: number;
}

interface SetupStatus {
  has_students: boolean;
  has_attendance: boolean;
  has_staff: boolean;
  student_count: number;
}

interface AbsentStudent {
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

interface PrepAlert {
  id: number;
  first_name: string;
  last_name: string;
  sacrament_prep: string;
  attended: number;
  sessions: number;
  missed_pct: number;
  contact_name?: string;
  contact_phone?: string;
}

const STAT_ICONS = [
  { icon: Users,       bg: 'bg-blue-100',   text: 'text-blue-600'   },
  { icon: Clock,       bg: 'bg-amber-100',  text: 'text-amber-600'  },
  { icon: CalendarCheck, bg: 'bg-green-100', text: 'text-green-600' },
  { icon: TrendingUp,  bg: 'bg-purple-100', text: 'text-purple-600' },
];

function getDaysUntilBirthday(dob: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dob + 'T00:00:00');
  let birthday = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (birthday < today) birthday = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.floor((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<{ date: string; count: number }[]>([]);
  const [trend, setTrend] = useState<TrendEntry[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayStudent[]>([]);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [absent, setAbsent] = useState<AbsentStudent[]>([]);
  const [prepAlerts, setPrepAlerts] = useState<PrepAlert[]>([]);
  const [setupDismissed, setSetupDismissed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/attendance?date=${today}`).then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
      fetch('/api/attendance?stats=1').then(r => r.json()),
      fetch('/api/attendance?trend=1').then(r => r.json()),
      fetch('/api/students/birthdays?days=7').then(r => r.json()),
      fetch('/api/setup-status').then(r => r.json()).catch(() => null),
      fetch('/api/students/absent?days=21').then(r => r.json()).catch(() => []),
      fetch('/api/students/prep-alerts').then(r => r.json()).catch(() => []),
    ]).then(([att, grps, st, tr, bdays, setupData, abs, prep]) => {
      setRecords(Array.isArray(att) ? att : []);
      setGroups(Array.isArray(grps) ? grps : []);
      setStats(Array.isArray(st) ? st : []);
      setTrend(Array.isArray(tr) ? tr : []);
      setBirthdays(Array.isArray(bdays) ? bdays : []);
      setAbsent(Array.isArray(abs) ? abs : []);
      setPrepAlerts(Array.isArray(prep) ? prep : []);
      if (setupData && !setupData.error) setSetup(setupData);
      setSetupDismissed(localStorage.getItem('setup_checklist_dismissed') === '1');
    }).finally(() => setLoading(false));
  }, [today]);

  function dismissSetup() {
    localStorage.setItem('setup_checklist_dismissed', '1');
    setSetupDismissed(true);
  }

  const setupSteps = setup ? [
    {
      label: 'Add your students',
      hint: 'Import your Flocknote CSV or add them one at a time',
      done: setup.has_students,
      href: setup.has_students ? '/students' : '/admin/import',
      cta: 'Import students',
    },
    {
      label: 'Record your first check-in',
      hint: 'Try the Attendance page, or open the Kiosk on a tablet',
      done: setup.has_attendance,
      href: '/attendance',
      cta: 'Take attendance',
    },
    {
      label: 'Add accounts for teachers & leaders',
      hint: 'Each helper gets their own login with just the access they need',
      done: setup.has_staff,
      href: '/admin/users',
      cta: 'Add users',
    },
  ] : [];
  const setupComplete = setupSteps.every(s => s.done);
  const showSetup = setup && !setupComplete && !setupDismissed;

  const checkedIn = records.filter(r => r.check_in_time && !r.check_out_time).length;
  const checkedOut = records.filter(r => r.check_out_time).length;
  const totalToday = records.length;
  const avgAttendance = stats.length
    ? Math.round(stats.reduce((sum, s) => sum + s.count, 0) / stats.length)
    : 0;

  const statCards = [
    { label: 'Present Today', value: checkedIn },
    { label: 'Checked Out',   value: checkedOut },
    { label: 'Total Today',   value: totalToday },
    { label: '30-Day Avg',    value: avgAttendance },
  ];

  const topLevelGroups = groups.filter((g: Group & { parent_id?: number }) => !g.parent_id);
  const byGroup = topLevelGroups.map(g => ({
    ...g,
    count: records.filter(r => r.group_name === g.name && r.check_in_time && !r.check_out_time).length,
  }));

  const trendMax = Math.max(...trend.map(t => t.count), 1);

  return (
    <AppShell>
      <div className="space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            <StatCardsSkeleton />
            <PanelsSkeleton />
            <ListSkeleton rows={5} />
          </div>
        ) : (
          <>
            {/* ── First-run setup checklist ── */}
            {showSetup && (
              <div className="card p-6 border border-primary-100 bg-gradient-to-br from-primary-50/60 to-white relative">
                <button
                  onClick={dismissSetup}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                  title="Hide this checklist"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <Rocket size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Welcome! Let&apos;s get set up</h2>
                    <p className="text-sm text-gray-500">
                      {setupSteps.filter(s => s.done).length} of {setupSteps.length} steps done
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {setupSteps.map(step => (
                    <div key={step.label}
                      className={`flex items-center gap-3 p-3 rounded-xl ${step.done ? 'opacity-60' : 'bg-white shadow-sm'}`}>
                      {step.done
                        ? <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                        : <Circle size={20} className="text-gray-300 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${step.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {step.label}
                        </p>
                        {!step.done && <p className="text-xs text-gray-400 mt-0.5">{step.hint}</p>}
                      </div>
                      {!step.done && (
                        <Link href={step.href}
                          className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 flex-shrink-0">
                          {step.cta} <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card, i) => {
                const { icon: Icon, bg, text } = STAT_ICONS[i];
                return (
                  <div key={card.label} className="card p-5 flex items-center gap-4">
                    <div className={`${bg} ${text} rounded-2xl p-3 flex-shrink-0`}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <p className="text-3xl font-medium text-gray-900">{card.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Birthday reminders + Trend chart ── */}
            <div className="grid lg:grid-cols-2 gap-4">

              {/* Birthday reminders */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center gap-2">
                  <Cake size={16} className="text-pink-500" />
                  <h2 className="font-medium text-gray-900 text-sm">Upcoming Birthdays</h2>
                  <span className="ml-auto text-xs text-gray-400">Next 7 days</span>
                </div>
                {birthdays.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-gray-400">No birthdays in the next 7 days</p>
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant/30">
                    {birthdays.map(s => {
                      const days = getDaysUntilBirthday(s.date_of_birth);
                      const dob = new Date(s.date_of_birth + 'T00:00:00');
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                            <Cake size={16} className="text-pink-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                            <p className="text-xs text-gray-400">
                              {dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                          {s.group_name && <Badge label={s.group_name} color={s.group_color} />}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                            days === 0 ? 'bg-pink-500 text-white' :
                            days <= 2 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {days === 0 ? 'Today!' : `${days}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attendance trend chart (pure CSS, no library) */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center gap-2">
                  <BarChart2 size={16} className="text-primary-500" />
                  <h2 className="font-medium text-gray-900 text-sm">Attendance Trend</h2>
                  <span className="ml-auto text-xs text-gray-400">Last 8 weeks</span>
                </div>
                <div className="px-5 py-4">
                  {trend.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No attendance data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {trend.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-14 flex-shrink-0 text-right">{entry.week}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary-500 flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${Math.max((entry.count / trendMax) * 100, entry.count > 0 ? 8 : 0)}%` }}
                            >
                              {entry.count > 0 && (
                                <span className="text-xs text-white font-medium">{entry.count}</span>
                              )}
                            </div>
                          </div>
                          {entry.count === 0 && (
                            <span className="text-xs text-gray-400 w-4">0</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Sacramental prep attendance alerts ── */}
            {prepAlerts.length > 0 && (
              <div className="card overflow-hidden border-2 border-violet-200">
                <div className="px-5 py-4 border-b border-violet-100 bg-violet-50 flex items-center gap-2">
                  <span className="text-base">✝</span>
                  <h2 className="font-semibold text-gray-900 text-sm">Sacramental Prep — Attendance Alert</h2>
                  <span className="ml-auto text-xs text-violet-600 font-medium">
                    Missed over 75% of classes
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/30">
                  {prepAlerts.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/students/${s.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600">
                            {s.first_name} {s.last_name}
                          </Link>
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                            {s.sacrament_prep}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Attended {s.attended} of {s.sessions} classes this year — missed {s.missed_pct}%
                        </p>
                      </div>
                      {s.contact_phone && (
                        <a
                          href={`tel:${s.contact_phone}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-full text-xs font-medium transition-colors flex-shrink-0"
                          title={s.contact_name ? `Call ${s.contact_name}` : 'Call family'}
                        >
                          <Phone size={12} />
                          {s.contact_name ? s.contact_name.split(' ')[0] : 'Call'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Absence follow-up ── */}
            {absent.length > 0 && (
              <div className="card overflow-hidden border border-rose-100">
                <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/50 flex items-center gap-2">
                  <HeartHandshake size={16} className="text-rose-500" />
                  <h2 className="font-medium text-gray-900 text-sm">Worth a Check-In Call</h2>
                  <span className="ml-auto text-xs text-gray-400">
                    Haven&apos;t been here in 3+ weeks
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/30">
                  {absent.slice(0, 8).map(s => {
                    const weeksAgo = Math.floor((Date.now() - new Date(s.last_seen + 'T00:00:00').getTime()) / (7 * 24 * 3600 * 1000));
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <Link href={`/students/${s.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600">
                            {s.first_name} {s.last_name}
                          </Link>
                          <p className="text-xs text-gray-400">
                            Last here {new Date(s.last_seen + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            {' '}({weeksAgo} week{weeksAgo !== 1 ? 's' : ''} ago)
                            {s.group_name ? ` · ${s.group_name}` : ''}
                          </p>
                        </div>
                        {s.contact_phone && (
                          <a
                            href={`tel:${s.contact_phone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full text-xs font-medium transition-colors flex-shrink-0"
                            title={s.contact_name ? `Call ${s.contact_name}` : 'Call family'}
                          >
                            <Phone size={12} />
                            {s.contact_name ? s.contact_name.split(' ')[0] : 'Call'}
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {absent.length > 8 && (
                    <p className="px-5 py-3 text-xs text-gray-400 text-center">
                      +{absent.length - 8} more student{absent.length - 8 !== 1 ? 's' : ''} to follow up with
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Kiosk launch card ── */}
            <div className="card p-5 flex items-center gap-4 bg-gradient-to-r from-gray-900 to-primary-900 text-white">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Monitor size={22} className="text-primary-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold">Check-In Kiosk</h2>
                <p className="text-sm text-primary-200/80">
                  Full-screen self check-in — open this on the tablet at the door
                </p>
              </div>
              <Link
                href="/kiosk"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-primary-900 text-sm font-semibold hover:bg-primary-50 transition-colors flex-shrink-0"
              >
                Launch Kiosk <ArrowRight size={15} />
              </Link>
            </div>

            {/* ── Group breakdown ── */}
            {byGroup.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {byGroup.map(g => (
                  <div key={g.id} className="card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                      <h3 className="font-medium text-gray-700 text-sm">{g.name}</h3>
                    </div>
                    <p className="text-4xl font-medium" style={{ color: g.color }}>{g.count}</p>
                    <p className="text-xs text-gray-400 mt-1">currently present</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Today's check-ins list ── */}
            <div className="card overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between border-b border-outline-variant/40">
                <h2 className="font-medium text-gray-900">Today&apos;s Check-ins</h2>
                <span className="text-sm text-gray-400">{totalToday} total</span>
              </div>

              {records.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CalendarCheck size={36} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-400">No check-ins yet today</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/30">
                  {records.slice(0, 15).map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                      <Avatar
                        name={`${r.first_name} ${r.last_name}`}
                        photoUrl={r.photo_url}
                        size="sm"
                        color={r.group_color}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {r.first_name} {r.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          In: {r.check_in_time
                            ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                          {r.check_out_time && ` · Out: ${new Date(r.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      {r.group_name && <Badge label={r.group_name} color={r.group_color} />}
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.check_out_time ? 'bg-gray-300' : 'bg-green-500'}`} />
                    </div>
                  ))}
                  {records.length > 15 && (
                    <p className="px-6 py-3 text-sm text-gray-400 text-center">
                      +{records.length - 15} more — view all in Attendance
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
