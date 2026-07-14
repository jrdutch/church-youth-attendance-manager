'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { toast } from '@/components/Toast';
import { Mail, Send, CheckCircle, AlertTriangle, CalendarCheck, Cake, UserPlus, HeartHandshake } from 'lucide-react';

interface Status {
  configured: boolean;
  to: string | null;
  last_sent: string | null;
}
interface Preview {
  attendance: { date: string; count: number }[];
  newStudents: { first_name: string; last_name: string }[];
  newGuests: { first_name: string; last_name: string; visit_count: number }[];
  birthdays: { first_name: string; last_name: string; date_of_birth: string }[];
  absent: { first_name: string; last_name: string; last_seen: string }[];
}

export default function SummaryPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/summary');
      const data = await res.json();
      setStatus(data.status);
      setPreview(data.preview);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function sendNow() {
    setSending(true);
    try {
      const res = await fetch('/api/admin/summary', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Summary email sent!');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  const totalCheckins = preview?.attendance.reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <AppShell>
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-medium text-gray-900 flex items-center gap-2">
            <Mail size={24} className="text-primary-500" /> Weekly Email Summary
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            A digest of attendance, new faces, birthdays, and follow-ups — sent automatically once a week
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Status */}
            {status?.configured ? (
              <div className="card p-5 bg-green-50 border border-green-200 flex items-center gap-4">
                <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Email is set up</p>
                  <p className="text-sm text-gray-600">
                    Sends to <strong>{status.to}</strong>
                    {status.last_sent
                      ? ` · last sent ${new Date(status.last_sent).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                      : ' · nothing sent yet'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sends automatically once a week whenever the app is in use
                  </p>
                </div>
                <button onClick={sendNow} disabled={sending} className="btn-filled flex-shrink-0 text-sm">
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={15} />}
                  Send Now
                </button>
              </div>
            ) : (
              <div className="card p-5 bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-700 space-y-2">
                    <p className="font-semibold text-gray-900">Email isn&apos;t set up yet</p>
                    <p>To turn this on, add these lines to the <code className="bg-amber-100 px-1 rounded">.env.local</code> file
                       in the church-attendance folder, then restart the app:</p>
                    <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs overflow-x-auto">{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourchurch.org
SMTP_PASS=your-app-password
SUMMARY_EMAIL_TO=you@yourchurch.org`}</pre>
                    <p className="text-xs text-gray-500">
                      For Gmail / Google Workspace, create an &ldquo;App Password&rdquo; at{' '}
                      <span className="font-mono">myaccount.google.com → Security → App passwords</span>{' '}
                      (requires 2-step verification). Use that as SMTP_PASS — not your regular password.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview of what would be sent */}
            {preview && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 text-sm">This Week&apos;s Digest Preview</h2>
                </div>
                <div className="divide-y divide-gray-50 text-sm">
                  <div className="px-5 py-3.5 flex items-center gap-3">
                    <CalendarCheck size={16} className="text-primary-500 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">Attendance</span>
                    <span className="font-semibold text-gray-900">
                      {totalCheckins} check-in{totalCheckins !== 1 ? 's' : ''} · {preview.attendance.length} session{preview.attendance.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="px-5 py-3.5 flex items-center gap-3">
                    <UserPlus size={16} className="text-teal-500 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">New students &amp; guests</span>
                    <span className="font-semibold text-gray-900">
                      {preview.newStudents.length + preview.newGuests.length}
                    </span>
                  </div>
                  <div className="px-5 py-3.5 flex items-center gap-3">
                    <Cake size={16} className="text-pink-500 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">Birthdays in the next 7 days</span>
                    <span className="font-semibold text-gray-900">{preview.birthdays.length}</span>
                  </div>
                  <div className="px-5 py-3.5 flex items-center gap-3">
                    <HeartHandshake size={16} className="text-rose-500 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">Absent 3+ weeks (follow-up list)</span>
                    <span className="font-semibold text-gray-900">{preview.absent.length}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
