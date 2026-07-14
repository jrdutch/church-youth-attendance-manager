'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { Search, X } from 'lucide-react';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  grade?: string;
  photo_url?: string;
  group_name?: string;
  group_color?: string;
}

export default function GlobalSearch({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<Student[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the student list once, on first open
  const ensureLoaded = useCallback(() => {
    if (students !== null) return;
    fetch('/api/students')
      .then(r => r.json())
      .then(d => setStudents(Array.isArray(d) ? d : (d.students ?? [])))
      .catch(() => setStudents([]));
  }, [students]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Keyboard shortcut: "/" focuses search (desktop)
  useEffect(() => {
    if (variant !== 'desktop') return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant]);

  const q = query.trim().toLowerCase();
  const results = q && students
    ? students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        `${s.last_name} ${s.first_name}`.toLowerCase().includes(q)
      ).slice(0, 8)
    : [];

  function go(id: number) {
    setOpen(false);
    setQuery('');
    router.push(`/students/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && results[highlighted]) { e.preventDefault(); go(results[highlighted].id); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  const dropdown = open && query.trim() !== '' && (
    <div className={`absolute top-full mt-2 bg-white rounded-2xl shadow-el3 overflow-hidden z-50
      ${variant === 'desktop' ? 'right-0 w-80' : 'left-0 right-0'}`}>
      {results.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">
          {students === null ? 'Loading…' : 'No students match that name'}
        </p>
      ) : results.map((s, i) => (
        <button
          key={s.id}
          onClick={() => go(s.id)}
          onMouseEnter={() => setHighlighted(i)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
            ${i === highlighted ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
        >
          <Avatar name={`${s.first_name} ${s.last_name}`} photoUrl={s.photo_url} size="sm" color={s.group_color} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-gray-900 truncate">
              {s.first_name} {s.last_name}
            </span>
            <span className="block text-xs text-gray-400 truncate">
              {[s.grade && `Grade ${s.grade}`, s.group_name].filter(Boolean).join(' · ') || 'No group'}
            </span>
          </span>
        </button>
      ))}
    </div>
  );

  if (variant === 'mobile') {
    return (
      <div ref={boxRef} className="relative px-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-300" />
          <input
            type="text"
            value={query}
            onFocus={() => { setOpen(true); ensureLoaded(); }}
            onChange={e => { setQuery(e.target.value); setHighlighted(0); setOpen(true); ensureLoaded(); }}
            placeholder="Find a student…"
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 text-white placeholder-primary-300 rounded-full text-sm outline-none focus:bg-white/20 transition-colors"
          />
        </div>
        {dropdown}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative hidden md:block">
      {open ? (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0); ensureLoaded(); }}
            onKeyDown={onKeyDown}
            placeholder="Find a student…"
            className="w-56 pl-9 pr-8 py-2 bg-white/10 text-white placeholder-primary-300 rounded-full text-sm outline-none focus:bg-white/20 transition-all"
          />
          <button
            onClick={() => { setOpen(false); setQuery(''); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary-300 hover:text-white"
            aria-label="Close search"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setOpen(true); ensureLoaded(); }}
          title="Find a student (press /)"
          className="btn-icon text-primary-100 hover:text-white"
        >
          <Search size={18} />
        </button>
      )}
      {dropdown}
    </div>
  );
}
