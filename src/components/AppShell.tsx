'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';

interface Session {
  userId: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => setSession(data.user))
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar user={session} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:px-6">
        {children}
      </main>
    </div>
  );
}
