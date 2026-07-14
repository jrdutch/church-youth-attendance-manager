'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { CheckCircle, AlertCircle, Sparkles, Info } from 'lucide-react';
import Link from 'next/link';

interface Student { id: number; first_name: string; last_name: string; grade?: string; group_name?: string; }
interface EventType { id: number; name: string; description?: string; base_points: number; }

const ELIGIBLE_GRADES = ['6', '7', '8', '9', '10', '11', '12'];

function LogServiceForm() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedId = params.get('student');

  const [students, setStudents] = useState<Student[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    student_id: preselectedId || '',
    event_type_id: '',
    custom_event: '',
    date: new Date().toISOString().split('T')[0],
    leadership_bonus: false,
    reflection_bonus: false,
    bonus_points: '0',
    notes: '',
  });

  useEffect(() => {
    fetch('/api/students').then(r => r.json()).then(d => {
      const eligible = (d.students || d || []).filter((s: Student) => s.grade && ELIGIBLE_GRADES.includes(s.grade));
      setStudents(eligible);
    });
    fetch('/api/service/events').then(r => r.json()).then(d => {
      setEventTypes(Array.isArray(d) ? d : []);
    });
  }, []);

  const selectedEvent = eventTypes.find(e => e.id === Number(form.event_type_id));
  const basePoints = selectedEvent?.base_points ?? 0;
  const totalPoints = basePoints + (form.leadership_bonus ? 5 : 0) + (form.reflection_bonus ? 3 : 0) + Number(form.bonus_points || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student_id) { setError('Please select a student.'); return; }
    if (!form.event_type_id && !form.custom_event.trim()) { setError('Please select or enter an event.'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/service/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: Number(form.student_id),
          event_type_id: form.event_type_id ? Number(form.event_type_id) : undefined,
          event_name: selectedEvent?.name || form.custom_event.trim(),
          date: form.date,
          base_points: basePoints,
          leadership_bonus: form.leadership_bonus,
          reflection_bonus: form.reflection_bonus,
          bonus_points: Number(form.bonus_points || 0),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSuccess(true);
      setTimeout(() => {
        if (preselectedId) router.push(`/students/${preselectedId}`);
        else { setSuccess(false); setForm(f => ({ ...f, student_id: '', event_type_id: '', custom_event: '', notes: '', leadership_bonus: false, reflection_bonus: false, bonus_points: '0' })); }
      }, 1500);
    } catch {
      setError('Failed to save service entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-xl space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Log Service</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record service for a student in grades 6–12</p>
        </div>

        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
            <CheckCircle size={20} />
            <p className="text-sm font-medium">Service logged — {totalPoints} points added!</p>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="card p-6 space-y-5">

          {/* Student select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student <span className="text-red-500">*</span></label>
            <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
              className="field-outlined bg-white" required>
              <option value="">Select a student…</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} {s.grade ? `· Grade ${s.grade}` : ''} {s.group_name ? `· ${s.group_name}` : ''}
                </option>
              ))}
            </select>
            {students.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No eligible students found. Students must be in grades 6–12.</p>
            )}
          </div>

          {/* Event type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Event <span className="text-red-500">*</span></label>
            <select value={form.event_type_id} onChange={e => setForm(f => ({ ...f, event_type_id: e.target.value, custom_event: '' }))}
              className="field-outlined bg-white">
              <option value="">Select event…</option>
              {eventTypes.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.base_points} pts)</option>
              ))}
              <option value="">— Custom event —</option>
            </select>
            {!form.event_type_id && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Custom event name"
                  value={form.custom_event}
                  onChange={e => setForm(f => ({ ...f, custom_event: e.target.value }))}
                  className="field-outlined"
                />
              </div>
            )}
            {selectedEvent?.description && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Info size={11} /> {selectedEvent.description}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="field-outlined" />
          </div>

          {/* Bonuses */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Bonus Points</p>

            <label className="flex items-start gap-3 cursor-pointer p-3 bg-amber-50 rounded-xl border border-amber-100 hover:border-amber-300 transition-colors">
              <input type="checkbox" checked={form.leadership_bonus}
                onChange={e => setForm(f => ({ ...f, leadership_bonus: e.target.checked }))}
                className="mt-0.5 rounded" />
              <div>
                <p className="text-sm font-medium text-gray-800">Leadership Role <span className="text-amber-600 font-semibold">+5 pts</span></p>
                <p className="text-xs text-gray-500">Student organized or led a team at this event</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 bg-purple-50 rounded-xl border border-purple-100 hover:border-purple-300 transition-colors">
              <input type="checkbox" checked={form.reflection_bonus}
                onChange={e => setForm(f => ({ ...f, reflection_bonus: e.target.checked }))}
                className="mt-0.5 rounded" />
              <div>
                <p className="text-sm font-medium text-gray-800">Submitted Reflection <span className="text-purple-600 font-semibold">+3 pts</span></p>
                <p className="text-xs text-gray-500">Student wrote a reflection paragraph for this event (max 3×/year)</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Additional Bonus Points (e.g., Consistency Bonus)
              </label>
              <input type="number" min="0" max="50" value={form.bonus_points}
                onChange={e => setForm(f => ({ ...f, bonus_points: e.target.value }))}
                className="field-outlined w-28" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Any details about the service…" className="field-outlined resize-none" />
          </div>

          {/* Points preview */}
          <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl border border-primary-100">
            <div className="flex items-center gap-2 text-primary-700">
              <Sparkles size={18} />
              <span className="text-sm font-medium">Points this entry</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary-700">{totalPoints}</span>
              <span className="text-sm text-primary-400 ml-1">pts</span>
              {totalPoints !== basePoints && (
                <p className="text-xs text-primary-400">
                  {basePoints} base
                  {form.leadership_bonus && ' + 5 leadership'}
                  {form.reflection_bonus && ' + 3 reflection'}
                  {Number(form.bonus_points) > 0 && ` + ${form.bonus_points} bonus`}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/service" className="btn-outlined flex-1 text-center">Cancel</Link>
            <button type="submit" disabled={saving} className="btn-filled flex-1">
              {saving ? 'Saving…' : 'Log Service'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default function LogServicePage() {
  return (
    <Suspense fallback={null}>
      <LogServiceForm />
    </Suspense>
  );
}
