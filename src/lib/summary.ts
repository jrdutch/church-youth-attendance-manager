import nodemailer from 'nodemailer';
import { getWeeklySummaryData, getSetting, setSetting } from './db';
import { APP_NAME, APP_PUBLIC_URL } from '@/config';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SUMMARY_EMAIL_TO);
}

export function getSummaryStatus() {
  return {
    configured: isEmailConfigured(),
    to: process.env.SUMMARY_EMAIL_TO || null,
    last_sent: getSetting('weekly_summary_last_sent'),
  };
}

function buildHtml(): { html: string; text: string } {
  const data = getWeeklySummaryData();
  const totalCheckins = data.attendance.reduce((a, b) => a + b.count, 0);

  const rows = (items: string[]) =>
    items.length === 0 ? '<p style="color:#9ca3af;margin:4px 0">None</p>'
    : `<ul style="margin:4px 0;padding-left:18px">${items.map(i => `<li style="margin:2px 0">${i}</li>`).join('')}</ul>`;

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <div style="background:#1e3a8a;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:20px">Youth Ministry — Weekly Summary</h1>
      <p style="margin:4px 0 0;opacity:.8;font-size:13px">${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">

      <h2 style="font-size:15px;margin:0 0 6px">📋 Attendance this week</h2>
      ${data.attendance.length === 0
        ? '<p style="color:#9ca3af;margin:4px 0">No sessions this week</p>'
        : `<p style="margin:4px 0"><strong>${totalCheckins}</strong> total check-ins across ${data.attendance.length} day${data.attendance.length !== 1 ? 's' : ''}:</p>` +
          rows(data.attendance.map(a => `${new Date(a.date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} — ${a.count} students`))}

      <h2 style="font-size:15px;margin:18px 0 6px">🎉 New students</h2>
      ${rows(data.newStudents.map(s => `${s.first_name} ${s.last_name}`))}

      <h2 style="font-size:15px;margin:18px 0 6px">👋 New guests</h2>
      ${rows(data.newGuests.map(g => `${g.first_name} ${g.last_name} (${g.visit_count} visit${g.visit_count !== 1 ? 's' : ''})`))}

      <h2 style="font-size:15px;margin:18px 0 6px">🎂 Birthdays in the next 7 days</h2>
      ${rows(data.birthdays.map(b => `${b.first_name} ${b.last_name} — ${new Date(b.date_of_birth + 'T00:00:00').toLocaleDateString([], { month: 'long', day: 'numeric' })}`))}

      <h2 style="font-size:15px;margin:18px 0 6px">✝ Sacramental prep — attendance concerns</h2>
      ${rows(data.prepAlerts.map(p => `<strong>${p.first_name} ${p.last_name}</strong> (${p.sacrament_prep}) — attended ${p.attended} of ${p.sessions} classes, missed ${p.missed_pct}%${p.contact_phone ? ` · ${p.contact_name || 'family'}: ${p.contact_phone}` : ''}`))}

      <h2 style="font-size:15px;margin:18px 0 6px">💛 Worth a check-in call (absent 3+ weeks)</h2>
      ${rows(data.absent.slice(0, 10).map(a => `${a.first_name} ${a.last_name} — last here ${new Date(a.last_seen + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}${a.contact_phone ? ` · ${a.contact_name || 'family'}: ${a.contact_phone}` : ''}`))}

      <p style="margin:22px 0 0;font-size:12px;color:#9ca3af">
        Sent automatically by ${APP_NAME}${APP_PUBLIC_URL ? ` · <a href="${APP_PUBLIC_URL}" style="color:#1e3a8a">Open the app</a>` : ''}
      </p>
    </div>
  </div>`;

  const text = `Youth Ministry Weekly Summary\n\n` +
    `Check-ins this week: ${totalCheckins}\n` +
    `New students: ${data.newStudents.map(s => `${s.first_name} ${s.last_name}`).join(', ') || 'none'}\n` +
    `New guests: ${data.newGuests.map(g => `${g.first_name} ${g.last_name}`).join(', ') || 'none'}\n` +
    `Birthdays next 7 days: ${data.birthdays.map(b => `${b.first_name} ${b.last_name}`).join(', ') || 'none'}\n` +
    `Prep attendance concerns: ${data.prepAlerts.map(p => `${p.first_name} ${p.last_name} (${p.sacrament_prep}, missed ${p.missed_pct}%)`).join(', ') || 'none'}\n` +
    `Absent 3+ weeks: ${data.absent.map(a => `${a.first_name} ${a.last_name}`).join(', ') || 'none'}\n`;

  return { html, text };
}

export async function sendWeeklySummary(): Promise<void> {
  if (!isEmailConfigured()) throw new Error('Email is not configured');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const { html, text } = buildHtml();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.SUMMARY_EMAIL_TO,
    subject: `Youth Ministry Weekly Summary — ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
    html,
    text,
  });

  setSetting('weekly_summary_last_sent', new Date().toISOString());
}

/** Send the weekly summary if configured and it's been 7+ days. Called opportunistically. */
export async function maybeSendWeeklySummary(): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const last = getSetting('weekly_summary_last_sent');
    if (last && Date.now() - new Date(last).getTime() < WEEK_MS) return;
    await sendWeeklySummary();
    console.log('Weekly summary email sent.');
  } catch (err) {
    console.error('Weekly summary failed:', err);
  }
}
