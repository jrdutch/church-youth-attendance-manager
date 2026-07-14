'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { APP_NAME } from '@/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) router.push('/dashboard');
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-primary-700 flex items-center justify-center p-4">
      {/* Radial background accents */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, #fbdd78 0%, transparent 45%), radial-gradient(circle at 75% 80%, #337da8 0%, transparent 50%)',
        }}
      />

      {/* MD3 login card */}
      <div className="relative w-full max-w-sm">
        <div className="h-1.5 bg-gold-400 rounded-t-3xl" />
        <div className="bg-white rounded-b-3xl shadow-el4 px-8 py-8">

          {/* Logo + heading */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full shadow-el2 mb-4 overflow-hidden">
              <Image src="/logo.png" alt="Logo" width={80} height={80} className="object-cover" />
            </div>
            <h1 className="text-2xl font-medium text-gray-900 tracking-tight">{APP_NAME}</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@church.org"
                required
                className="field-outlined"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="field-outlined pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-filled w-full mt-1">
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <LogIn size={16} />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Contact your administrator for access
          </p>
        </div>
      </div>
    </div>
  );
}
