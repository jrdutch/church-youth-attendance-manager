'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { toast } from '@/components/Toast';
import { Award, Star, Trophy, Plus, RefreshCw, ChevronRight, Flame } from 'lucide-react';

interface Summary {
  student_id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  group_name?: string;
  total_points: number;
  entry_count: number;
  scholarship_label: string;
  scholarship_amount: number;
}

const TIERS = [
  { min: 125, label: 'Full Event',  color: 'bg-amber-100 text-amber-800 border-amber-300',  icon: '🏆', bar: 'bg-amber-500' },
  { min: 75,  label: '$75 Credit',  color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '🥇', bar: 'bg-purple-500' },
  { min: 50,  label: '$50 Credit',  color: 'bg-blue-100 text-blue-800 border-blue-300',       icon: '🥈', bar: 'bg-blue-500' },
  { min: 25,  label: '$25 Credit',  color: 'bg-green-100 text-green-800 border-green-300',    icon: '🥉', bar: 'bg-green-500' },
  { min: 0,   label: 'No Tier Yet', color: 'bg-gray-100 text-gray-600 border-gray-200',       icon: '·', bar: 'bg-gray-300' },
];

function getTierStyle(points: number) {
  return TIERS.find(t => points >= t.min) ?? TIERS[TIERS.length - 1];
}

function pointsToNextTier(points: number): { next: number; label: string } | null {
  const remaining = [125, 75, 50, 25].find(t => t > points);
  if (!remaining) return null;
  const tier = TIERS.find(t => t.min === remaining)!;
  return { next: remaining - points, label: tier.label };
}

interface BonusCandidate {
  student_id: number;
  first_name: string;
  last_name: string;
  attended: number;
  sessions: number;
  rate: number;
  already_awarded: boolean;
}

export default function ServicePage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [bonusCandidates, setBonusCandidates] = useState<BonusCandidate[]>([]);
  const [awarding, setAwarding] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [res, bonusRes] = await Promise.all([
        fetch('/api/service/summary'),
        fetch('/api/service/attendance-bonus'),
      ]);
      const data = await res.json();
      setSummaries(Array.isArray(data) ? data : []);
      const bonus = await bonusRes.json().catch(() => []);
      setBonusCandidates(Array.isArray(bonus) ? bonus : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function awardBonus(c: BonusCandidate) {
    setAwarding(c.student_id);
    try {
      const res = await fetch('/api/service/attendance-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: c.student_id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`20 pts awarded to ${c.first_name}!`);
      await load();
    } catch {
      toast.error('Could not award bonus — please try again');
    } finally {
      setAwarding(null);
    }
  }

  const unawarded = bonusCandidates.filter(c => !c.already_awarded);

  const grades = Array.from(new Set(summaries.map(s => s.grade).filter(Boolean))).sort();
  const filtered = filter === 'all' ? summaries
    : filter === 'tier' ? summaries.filter(s => s.total_points >= 25)
    : summaries.filter(s => s.grade === filter);

  const enrolled = summaries.filter(s => s.total_points >= 125).length;
  const credited = summaries.filter(s => s.total_points >= 25 && s.total_points < 125).length;
  const totalEntries = summaries.reduce((a, b) => a + b.entry_count, 0);

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Service Points</h1>
            <p className="text-sm text-gray-500 mt-0.5">Grades 6–12 · Scholarship reward program</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="btn-icon text-gray-400 hover:text-primary-600" title="Refresh">
              <RefreshCw size={18} />
            </button>
            <Link href="/service/log" className="btn-filled flex items-center gap-2 text-sm">
              <Plus size={16} /> Log Service
            </Link>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Participants', value: summaries.length, color: 'text-primary-600', bg: 'bg-primary-50' },
            { label: 'Service Entries', value: totalEntries, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'With Scholarship', value: enrolled + credited, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Full Event Earned', value: enrolled, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className={`card p-4 text-center ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 90% attendance bonus candidates */}
        {unawarded.length > 0 && (
          <div className="card p-5 border border-orange-200 bg-orange-50/50">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={18} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900 text-sm">
                Attendance Bonus Earned — {unawarded.length} teen{unawarded.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              These teens attended 90%+ of youth group sessions in the last 16 weeks.
              Tap to award the 20-point consistency bonus (once per year).
            </p>
            <div className="space-y-2">
              {unawarded.map(c => (
                <div key={c.student_id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-400">
                      {c.attended} of {c.sessions} sessions · {Math.round(c.rate * 100)}%
                    </p>
                  </div>
                  <button
                    onClick={() => awardBonus(c)}
                    disabled={awarding === c.student_id}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    {awarding === c.student_id
                      ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Award size={13} />}
                    Award 20 pts
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scholarship tier legend */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Scholarship Tiers</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {[
              { pts: '125+', label: 'Full Event Covered', icon: '🏆' },
              { pts: '75+',  label: '$75 Credit',          icon: '🥇' },
              { pts: '50+',  label: '$50 Credit',          icon: '🥈' },
              { pts: '25+',  label: '$25 Credit',          icon: '🥉' },
            ].map(t => (
              <div key={t.pts} className="flex items-center gap-2 text-gray-700">
                <span className="text-base">{t.icon}</span>
                <div>
                  <span className="font-semibold">{t.pts} pts</span>
                  <span className="text-gray-400"> — {t.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${filter === 'all' ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
            All Students
          </button>
          <button onClick={() => setFilter('tier')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${filter === 'tier' ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
            Earned Scholarship
          </button>
          {grades.map(g => (
            <button key={g} onClick={() => setFilter(g!)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${filter === g ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
              Grade {g === 'K' ? 'K' : g}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-16 text-center">
            <Trophy size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No teens in the point program yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              Students in grades 6–12 appear here automatically. Make sure each teen&apos;s
              profile has their grade filled in.
            </p>
            <Link href="/students" className="btn-outlined text-sm inline-flex">View Students</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s, i) => {
              const tier = getTierStyle(s.total_points);
              const nextTier = pointsToNextTier(s.total_points);
              const pct = Math.min((s.total_points / 125) * 100, 100);

              return (
                <Link
                  key={s.student_id}
                  href={`/students/${s.student_id}`}
                  className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {i === 0 ? <span className="text-xl">🥇</span>
                    : i === 1 ? <span className="text-xl">🥈</span>
                    : i === 2 ? <span className="text-xl">🥉</span>
                    : <span className="text-sm font-bold text-gray-400">#{i + 1}</span>}
                  </div>

                  {/* Name + grade */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">
                        {s.first_name} {s.last_name}
                      </p>
                      {s.grade && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Grade {s.grade}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5">
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${tier.bar} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {nextTier
                          ? `${nextTier.next} pts to ${nextTier.label}`
                          : 'Maximum scholarship earned!'}
                      </p>
                    </div>
                  </div>

                  {/* Points + tier badge */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{s.total_points}</p>
                      <p className="text-xs text-gray-400">pts</p>
                    </div>
                    {s.total_points >= 25 && (
                      <span className={`hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${tier.color}`}>
                        {tier.icon} {tier.label}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
