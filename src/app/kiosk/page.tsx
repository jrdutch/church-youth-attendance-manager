'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Avatar from '@/components/Avatar';
import { APP_NAME } from '@/config';
import { CheckCircle, Monitor, RefreshCw, AlertTriangle, WifiOff, UserPlus, Phone, Star } from 'lucide-react';
import { format } from 'date-fns';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  photo_url?: string;
  group_id?: number;
  group_name?: string;
  group_color?: string;
  grade?: string;
}

interface Group {
  id: number;
  name: string;
  color: string;
  type: string;
  parent_id?: number;
}

interface MedicalAlert {
  allergies?: string;
  conditions?: string;
}

interface OfflineQueueItem {
  student_id: number;
  date: string;
  timestamp: number;
}

interface GuestResult {
  first_name: string;
  last_name: string;
  visit_count: number;
  converted: boolean;
  just_converted: boolean;
  is_first_visit: boolean;
}

const OFFLINE_QUEUE_KEY = 'kiosk_offline_queue';
const GUEST_CHECKIN_THRESHOLD = 3; // convert after this many visits

type CheckInState = 'idle' | 'checking' | 'success' | 'already';

export default function KioskPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<number>>(new Set());
  const [checkInState, setCheckInState] = useState<CheckInState>('idle');
  const [lastCheckedIn, setLastCheckedIn] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [today] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);

  // Medical alert modal state
  const [medicalAlertStudent, setMedicalAlertStudent] = useState<Student | null>(null);
  const [pendingMedicalAlert, setPendingMedicalAlert] = useState<MedicalAlert | null>(null);

  // Guest check-in state
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [guestChecking, setGuestChecking] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [guestResult, setGuestResult] = useState<GuestResult | null>(null);

  // Check-out / pickup state
  const [checkoutStudent, setCheckoutStudent] = useState<Student | null>(null);
  const [pickupContacts, setPickupContacts] = useState<{ first_name: string; last_name: string; relationship: string }[]>([]);
  const [pickupOther, setPickupOther] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutDone, setCheckoutDone] = useState<Student | null>(null);

  // Service point lookup state
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [pointsQuery, setPointsQuery] = useState('');
  const [pointsResults, setPointsResults] = useState<{
    first_name: string; last_name: string; grade: string; total: number;
    tier: { label: string; min: number } | null;
  }[] | null>(null);
  const [pointsBusy, setPointsBusy] = useState(false);

  const processingQueue = useRef(false);

  // ── Offline queue helpers ──────────────────────────────────────
  const getOfflineQueue = (): OfflineQueueItem[] => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); } catch { return []; }
  };

  const updateOfflineCount = useCallback(() => {
    setOfflineCount(getOfflineQueue().length);
  }, []);

  const processOfflineQueue = useCallback(async () => {
    if (processingQueue.current) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    processingQueue.current = true;
    const failed: OfflineQueueItem[] = [];
    for (const item of queue) {
      try {
        const res = await fetch('/api/attendance/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: item.student_id, date: item.date, kiosk_mode: true }),
        });
        if (!res.ok) failed.push(item);
        else setCheckedIn(prev => new Set([...prev, item.student_id]));
      } catch { failed.push(item); }
    }
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
    processingQueue.current = false;
    updateOfflineCount();
  }, [updateOfflineCount]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/students').then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
      fetch(`/api/attendance?date=${today}`).then(r => r.json()),
    ]).then(([s, g, att]) => {
      setStudents(Array.isArray(s) ? s : []);
      setGroups(Array.isArray(g) ? g : []);
      const alreadyIn = new Set<number>(
        Array.isArray(att)
          ? att
              .filter((a: { check_in_time?: string; check_out_time?: string }) => a.check_in_time && !a.check_out_time)
              .map((a: { student_id: number }) => a.student_id)
          : []
      );
      setCheckedIn(alreadyIn);
    }).finally(() => setLoading(false));
  }, [today]);

  useEffect(() => {
    loadData();
    updateOfflineCount();
    const handleOnline = () => { setIsOnline(true); processOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData, updateOfflineCount, processOfflineQueue]);

  // Auto-dismiss regular success screen
  useEffect(() => {
    if (checkInState === 'success' || checkInState === 'already') {
      const t = setTimeout(() => { setCheckInState('idle'); setLastCheckedIn(null); setSearch(''); }, 3000);
      return () => clearTimeout(t);
    }
  }, [checkInState]);

  // Auto-dismiss guest success screen
  useEffect(() => {
    if (guestResult) {
      const delay = guestResult.just_converted ? 6000 : 3500;
      const t = setTimeout(() => { setGuestResult(null); }, delay);
      return () => clearTimeout(t);
    }
  }, [guestResult]);

  // Auto-dismiss check-out success screen
  useEffect(() => {
    if (checkoutDone) {
      const t = setTimeout(() => setCheckoutDone(null), 3000);
      return () => clearTimeout(t);
    }
  }, [checkoutDone]);

  // ── Regular student check-in ──────────────────────────────────
  async function performCheckIn(student: Student) {
    setCheckInState('checking');
    setLastCheckedIn(student);
    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, date: today, kiosk_mode: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setCheckedIn(prev => new Set([...prev, student.id]));
        setCheckInState(data.already_checked_in ? 'already' : 'success');
      } else {
        setCheckInState('idle');
      }
    } catch {
      const queue = getOfflineQueue();
      queue.push({ student_id: student.id, date: today, timestamp: Date.now() });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      setCheckedIn(prev => new Set([...prev, student.id]));
      setCheckInState('success');
      updateOfflineCount();
    }
  }

  async function handleStudentClick(student: Student) {
    if (checkInState !== 'idle') return;

    // Already checked in → offer check-out with pickup tracking
    if (checkedIn.has(student.id)) {
      setCheckoutStudent(student);
      setPickupOther('');
      setCheckoutError('');
      setPickupContacts([]);
      try {
        const res = await fetch(`/api/attendance/checkout?pickup_list=1&student_id=${student.id}`);
        if (res.ok) {
          const data = await res.json();
          setPickupContacts(Array.isArray(data.contacts) ? data.contacts : []);
        }
      } catch { /* show manual entry only */ }
      return;
    }

    try {
      const res = await fetch(`/api/attendance/checkin?kiosk_preview=1&student_id=${student.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.has_alert && data.medical_alert) {
          setMedicalAlertStudent(student);
          setPendingMedicalAlert(data.medical_alert);
          return;
        }
      }
    } catch { /* proceed */ }
    await performCheckIn(student);
  }

  async function performCheckOut(pickedUpBy: string) {
    if (!checkoutStudent) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: checkoutStudent.id,
          date: today,
          kiosk_mode: true,
          picked_up_by: pickedUpBy,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCheckoutError(data.error || 'Could not check out — please find a leader');
        return;
      }
      setCheckedIn(prev => { const next = new Set(prev); next.delete(checkoutStudent.id); return next; });
      setCheckoutDone(checkoutStudent);
      setCheckoutStudent(null);
    } catch {
      setCheckoutError('No connection — please find a leader to check out');
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function lookupPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!pointsQuery.trim()) return;
    setPointsBusy(true);
    try {
      const res = await fetch(`/api/service/lookup?name=${encodeURIComponent(pointsQuery.trim())}`);
      const data = await res.json();
      setPointsResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setPointsResults([]);
    } finally {
      setPointsBusy(false);
    }
  }

  function confirmMedicalCheckIn() {
    if (!medicalAlertStudent) return;
    const student = medicalAlertStudent;
    setMedicalAlertStudent(null);
    setPendingMedicalAlert(null);
    performCheckIn(student);
  }

  // ── Guest check-in ────────────────────────────────────────────
  async function submitGuestCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setGuestError('');
    if (!guestForm.first_name.trim() || !guestForm.last_name.trim()) {
      setGuestError('Please enter both first and last name.'); return;
    }
    if (!guestForm.phone.trim()) {
      setGuestError('An emergency contact number is required.'); return;
    }
    setGuestChecking(true);
    try {
      const res = await fetch('/api/guests/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...guestForm, date: today }),
      });
      const data = await res.json();
      if (!res.ok) { setGuestError(data.error || 'Check-in failed.'); setGuestChecking(false); return; }
      setGuestModalOpen(false);
      setGuestForm({ first_name: '', last_name: '', phone: '' });
      setGuestResult({
        first_name: data.first_name,
        last_name: data.last_name,
        visit_count: data.visit_count,
        converted: data.converted,
        just_converted: data.just_converted,
        is_first_visit: data.is_first_visit,
      });
    } catch {
      setGuestError('Network error — please try again.');
    }
    setGuestChecking(false);
  }

  const visibleStudents = students.filter(s => {
    if (selectedGroup !== null && s.group_id !== selectedGroup) return false;
    if (search) {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const activeGroupIds = new Set(students.map(s => s.group_id));
  const visibleGroups = groups.filter(g => activeGroupIds.has(g.id));

  // ── Guest success screen ──────────────────────────────────────
  if (guestResult) {
    const isConversion = guestResult.just_converted;
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 text-center
        ${isConversion
          ? 'bg-gradient-to-br from-amber-600 to-orange-700'
          : 'bg-gradient-to-br from-teal-700 to-teal-900'}`}>

        <div className={`w-36 h-36 rounded-full flex items-center justify-center mx-auto mb-6 shadow-el4
          ${isConversion ? 'bg-amber-400' : 'bg-teal-500'}`}>
          {isConversion ? <Star size={68} className="text-white" /> : <UserPlus size={68} className="text-white" />}
        </div>

        <h1 className="text-5xl font-medium text-white mt-2">
          {guestResult.is_first_visit ? 'Welcome!' : isConversion ? "You're Family!" : 'Welcome Back!'}
        </h1>

        <p className="text-2xl text-white/80 mt-3 font-light">
          {guestResult.first_name} {guestResult.last_name}
        </p>

        {!isConversion && (
          <div className="mt-4 bg-white/15 rounded-2xl px-6 py-3">
            <p className="text-white font-medium text-lg">
              Guest Visit #{guestResult.visit_count}
            </p>
            {guestResult.visit_count < GUEST_CHECKIN_THRESHOLD && (
              <p className="text-white/60 text-sm mt-0.5">
                {GUEST_CHECKIN_THRESHOLD - guestResult.visit_count + 1} more visit{GUEST_CHECKIN_THRESHOLD - guestResult.visit_count + 1 !== 1 ? 's' : ''} until enrollment
              </p>
            )}
          </div>
        )}

        {isConversion && (
          <div className="mt-6 bg-white/15 rounded-3xl px-8 py-5 max-w-sm">
            <p className="text-white font-semibold text-xl mb-2">You&apos;ve been enrolled! 🎉</p>
            <p className="text-white/75 text-base leading-relaxed">
              We&apos;ve started your student profile. A staff member will reach out to complete your registration.
            </p>
          </div>
        )}

        <p className="text-white/40 mt-6 text-sm">Checked in successfully</p>
      </div>
    );
  }

  // ── Regular check-in success/already screen ───────────────────
  if (checkInState === 'success' || checkInState === 'already') {
    const success = checkInState === 'success';
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8
        ${success ? 'bg-gradient-to-br from-primary-700 to-primary-900' : 'bg-gradient-to-br from-amber-600 to-amber-800'}`}>
        <div className="text-center">
          <div className={`w-36 h-36 rounded-full flex items-center justify-center mx-auto mb-6 shadow-el4
            ${success ? 'bg-green-500' : 'bg-amber-500'}`}>
            <CheckCircle size={72} className="text-white" />
          </div>
          {lastCheckedIn && (
            <div className="mb-4">
              <Avatar
                name={`${lastCheckedIn.first_name} ${lastCheckedIn.last_name}`}
                photoUrl={lastCheckedIn.photo_url}
                size="xl"
                color={lastCheckedIn.group_color}
              />
            </div>
          )}
          <h1 className="text-5xl font-medium text-white mt-2">
            {success ? 'Welcome!' : 'Already Checked In!'}
          </h1>
          {lastCheckedIn && (
            <p className="text-2xl text-white/80 mt-3 font-light">
              {lastCheckedIn.first_name} {lastCheckedIn.last_name}
            </p>
          )}
          {lastCheckedIn?.group_name && (
            <p className="text-lg text-white/60 mt-1">{lastCheckedIn.group_name}</p>
          )}
          <p className="text-white/50 mt-6 text-base">
            {success ? 'You have been checked in successfully.' : 'You were already checked in for today.'}
          </p>
          {offlineCount > 0 && (
            <p className="text-white/40 mt-2 text-sm flex items-center justify-center gap-1">
              <WifiOff size={14} /> {offlineCount} check-in(s) queued offline
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Main kiosk screen ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* MD3 Top App Bar */}
      <header className="bg-primary-700 shadow-el3">
        <div className="h-1 bg-gold-400 w-full" />
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor size={22} className="text-gold-400" />
            <div>
              <h1 className="text-white font-medium text-lg">{APP_NAME} — Kiosk</h1>
              <p className="text-primary-300 text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isOnline && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 rounded-2xl px-3 py-1.5 text-xs">
                <WifiOff size={14} />
                Offline {offlineCount > 0 && `· ${offlineCount} queued`}
              </div>
            )}
            <div className="bg-white/10 rounded-2xl px-4 py-2 text-center">
              <p className="text-white font-medium text-xl leading-tight">{checkedIn.size}</p>
              <p className="text-primary-300 text-xs">Checked In</p>
            </div>
            <button
              onClick={loadData}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-200 hover:bg-white/20 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Group filter chips + search */}
      <div className="px-6 py-4 bg-gray-900 flex gap-2 overflow-x-auto items-center">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`px-6 py-3 min-h-[48px] rounded-full text-base font-medium flex-shrink-0 transition-all border-2
            ${selectedGroup === null
              ? 'bg-primary-500 border-primary-500 text-white shadow-el2'
              : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
        >
          All Groups
        </button>
        {visibleGroups.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id === selectedGroup ? null : g.id)}
            className="px-6 py-3 min-h-[48px] rounded-full text-base font-medium flex-shrink-0 transition-all border-2"
            style={selectedGroup === g.id
              ? { backgroundColor: g.color, borderColor: g.color, color: '#fff' }
              : { borderColor: '#374151', color: '#9ca3af' }}
          >
            {g.name}
          </button>
        ))}
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type your name…"
            className="w-full px-5 py-3 min-h-[48px] bg-gray-800 text-white placeholder-gray-500 rounded-full text-base outline-none border-2 border-gray-700 focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      {/* Student grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-4 border-primary-900 border-t-primary-400 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 p-6 overflow-y-auto">
          {visibleStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center px-6">
              <p className="text-xl font-medium">We couldn&apos;t find that name</p>
              <p className="text-base mt-2 text-gray-600">
                Try just the first name — or if you&apos;re visiting,
                tap <span className="text-teal-400 font-semibold">Guest Check-In</span> below
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {visibleStudents.map(s => {
                const isIn = checkedIn.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => handleStudentClick(s)}
                    disabled={checkInState === 'checking'}
                    className={`relative flex flex-col items-center p-5 rounded-3xl transition-all active:scale-95 border-2
                      ${isIn
                        ? 'bg-green-950 border-green-600 shadow-el2'
                        : 'bg-gray-900 border-gray-800 hover:border-primary-500 hover:bg-gray-800'}`}
                    style={{ minHeight: '176px' }}
                  >
                    {isIn && (
                      <div className="absolute top-3 right-3 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-el1">
                        <CheckCircle size={16} className="text-white" />
                      </div>
                    )}
                    <Avatar
                      name={`${s.first_name} ${s.last_name}`}
                      photoUrl={s.photo_url}
                      size="lg"
                      color={isIn ? '#16a34a' : (s.group_color || '#337da8')}
                    />
                    <p className={`mt-3 font-semibold text-center text-lg leading-tight ${isIn ? 'text-green-400' : 'text-white'}`}>
                      {s.first_name}
                    </p>
                    <p className={`text-sm text-center ${isIn ? 'text-green-500' : 'text-gray-400'}`}>
                      {s.last_name}
                    </p>
                    {s.group_name && (
                      <span
                        className="mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: (s.group_color || '#666') + 'cc' }}
                      >
                        {s.group_name.split(' ')[0]}
                      </span>
                    )}
                    {isIn && <p className="text-sm text-green-500 mt-1 font-medium">✓ In · tap to check out</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer with Guest Check-In CTA */}
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-between gap-4">
        <p className="text-gray-500 text-sm hidden sm:block">
          Tap your name to check in or out &nbsp;·&nbsp; {visibleStudents.length} shown
        </p>
        <div className="flex gap-3 flex-wrap justify-end">
          <button
            onClick={() => { setPointsModalOpen(true); setPointsQuery(''); setPointsResults(null); }}
            className="flex items-center gap-2.5 px-6 py-3.5 min-h-[52px] rounded-full bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-base font-semibold transition-all shadow-el2 flex-shrink-0"
          >
            <Star size={19} />
            My Service Points
          </button>
          <button
            onClick={() => { setGuestModalOpen(true); setGuestError(''); setGuestForm({ first_name: '', last_name: '', phone: '' }); }}
            className="flex items-center gap-2.5 px-6 py-3.5 min-h-[52px] rounded-full bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-base font-semibold transition-all shadow-el2 flex-shrink-0"
          >
            <UserPlus size={20} />
            Guest Check-In
          </button>
        </div>
      </footer>

      {/* ── Medical Alert Modal ─────────────────────────────────── */}
      {medicalAlertStudent && pendingMedicalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-3xl shadow-el4 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Medical Alert</h2>
                <p className="text-sm text-gray-500">{medicalAlertStudent.first_name} {medicalAlertStudent.last_name}</p>
              </div>
            </div>
            {pendingMedicalAlert.allergies && (
              <div className="mb-3 p-3 bg-red-50 rounded-2xl">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Allergies</p>
                <p className="text-sm text-red-800">{pendingMedicalAlert.allergies}</p>
              </div>
            )}
            {pendingMedicalAlert.conditions && (
              <div className="mb-3 p-3 bg-amber-50 rounded-2xl">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Medical Conditions</p>
                <p className="text-sm text-amber-800">{pendingMedicalAlert.conditions}</p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4 mb-5">
              Please ensure staff are aware of this student&apos;s medical information before proceeding.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setMedicalAlertStudent(null); setPendingMedicalAlert(null); }}
                className="flex-1 px-4 py-4 min-h-[52px] border-2 border-gray-300 rounded-2xl text-base font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmMedicalCheckIn}
                className="flex-1 px-4 py-4 min-h-[52px] bg-primary-600 text-white rounded-2xl text-base font-semibold hover:bg-primary-700 active:scale-95 transition-all"
              >
                Confirm Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest Check-In Modal ────────────────────────────────── */}
      {guestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl shadow-el4 w-full max-w-sm">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus size={22} className="text-teal-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Guest Check-In</h2>
                  <p className="text-sm text-gray-500">Visiting today? Check in here</p>
                </div>
              </div>
            </div>

            <form onSubmit={submitGuestCheckIn} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guestForm.first_name}
                    onChange={e => setGuestForm(p => ({ ...p, first_name: e.target.value }))}
                    placeholder="First"
                    required
                    autoFocus
                    className="w-full px-4 py-3.5 min-h-[52px] rounded-2xl border-2 border-gray-200 text-gray-900 text-base focus:border-teal-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guestForm.last_name}
                    onChange={e => setGuestForm(p => ({ ...p, last_name: e.target.value }))}
                    placeholder="Last"
                    required
                    className="w-full px-4 py-3.5 min-h-[52px] rounded-2xl border-2 border-gray-200 text-gray-900 text-base focus:border-teal-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Phone size={14} className="text-teal-600" />
                    Emergency Contact Number <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="tel"
                  value={guestForm.phone}
                  onChange={e => setGuestForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                  required
                  className="w-full px-4 py-3.5 min-h-[52px] rounded-2xl border-2 border-gray-200 text-gray-900 text-base focus:border-teal-500 focus:outline-none transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Used only in case of emergency
                </p>
              </div>

              {guestError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-200">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  {guestError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setGuestModalOpen(false)}
                  className="flex-1 px-4 py-4 min-h-[52px] border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={guestChecking}
                  className="flex-1 px-4 py-4 min-h-[52px] bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white rounded-2xl text-base font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {guestChecking
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <CheckCircle size={16} />}
                  {guestChecking ? 'Checking in…' : 'Check In as Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Check-Out / Pickup Modal ────────────────────────────── */}
      {checkoutStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-3xl shadow-el4 max-w-md w-full p-6">
            <div className="text-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                Check out {checkoutStudent.first_name}?
              </h2>
              <p className="text-sm text-gray-500 mt-1">Who is picking up today?</p>
            </div>

            {checkoutError && (
              <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-200">
                <AlertTriangle size={15} className="flex-shrink-0" />
                {checkoutError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pickupContacts.map((c, i) => (
                <button
                  key={i}
                  disabled={checkoutBusy}
                  onClick={() => performCheckOut(`${c.first_name} ${c.last_name}`)}
                  className="w-full flex items-center gap-3 px-5 py-4 min-h-[56px] rounded-2xl border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold flex-shrink-0">
                    {c.first_name[0]}{c.last_name[0] || ''}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{c.relationship} · authorized</p>
                  </div>
                </button>
              ))}
              {pickupContacts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3">
                  No authorized adults on file — enter the name below
                </p>
              )}
            </div>

            {/* Someone else */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Someone else (full name)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pickupOther}
                  onChange={e => setPickupOther(e.target.value)}
                  placeholder="Adult's full name"
                  className="flex-1 px-4 py-3 min-h-[52px] rounded-2xl border-2 border-gray-200 text-gray-900 text-base focus:border-primary-500 focus:outline-none transition-colors"
                />
                <button
                  disabled={checkoutBusy || !pickupOther.trim()}
                  onClick={() => performCheckOut(pickupOther)}
                  className="px-5 py-3 min-h-[52px] rounded-2xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-base font-semibold transition-all active:scale-95"
                >
                  {checkoutBusy ? '…' : 'OK'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setCheckoutStudent(null)}
              className="w-full mt-4 px-4 py-3.5 min-h-[52px] border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Check-Out Success Screen ────────────────────────────── */}
      {checkoutDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/95">
          <div className="text-center px-6">
            <div className="w-24 h-24 rounded-full bg-primary-500 flex items-center justify-center mx-auto mb-6 shadow-el3">
              <CheckCircle size={48} className="text-white" />
            </div>
            <h2 className="text-4xl font-bold text-white">
              Goodbye, {checkoutDone.first_name}!
            </h2>
            <p className="text-xl text-primary-200 mt-3">Checked out — see you next time! 👋</p>
          </div>
        </div>
      )}

      {/* ── Service Points Lookup Modal ─────────────────────────── */}
      {pointsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-3xl shadow-el4 max-w-md w-full p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Star size={26} className="text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">My Service Points</h2>
              <p className="text-sm text-gray-500 mt-1">Type your name to see your total (grades 6–12)</p>
            </div>

            <form onSubmit={lookupPoints} className="flex gap-2">
              <input
                type="text"
                value={pointsQuery}
                onChange={e => setPointsQuery(e.target.value)}
                placeholder="Your name…"
                autoFocus
                className="flex-1 px-4 py-3 min-h-[52px] rounded-2xl border-2 border-gray-200 text-gray-900 text-base focus:border-amber-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={pointsBusy || !pointsQuery.trim()}
                className="px-5 py-3 min-h-[52px] rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-base font-semibold transition-all active:scale-95"
              >
                {pointsBusy ? '…' : 'Look Up'}
              </button>
            </form>

            {pointsResults !== null && (
              <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
                {pointsResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">
                    No match found — try just your first name, and make sure you&apos;re in grades 6–12
                  </p>
                ) : pointsResults.map((r, i) => {
                  const pct = Math.min((r.total / 125) * 100, 100);
                  return (
                    <div key={i} className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{r.first_name} {r.last_name}</p>
                        <p className="text-2xl font-bold text-amber-700">{r.total} <span className="text-sm font-normal">pts</span></p>
                      </div>
                      <div className="w-full bg-amber-200/60 rounded-full h-2.5 mt-2">
                        <div className="h-2.5 rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-amber-800 mt-1.5 font-medium">
                        {r.tier
                          ? `🎉 ${r.tier.label} scholarship earned!`
                          : `${25 - r.total > 0 ? 25 - r.total : 0} pts to your first scholarship ($25 off an event)`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setPointsModalOpen(false)}
              className="w-full mt-5 px-4 py-3.5 min-h-[52px] border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
