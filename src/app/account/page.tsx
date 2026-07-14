'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { User, Lock, CheckCircle, AlertCircle } from 'lucide-react';

interface Profile { id: number; name: string; email: string; role: string; }
type AlertMsg = { type: 'success' | 'error'; message: string } | null;

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [profileAlert, setProfileAlert] = useState<AlertMsg>(null);
  const [pwAlert, setPwAlert] = useState<AlertMsg>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch('/api/account').then(r => r.json()).then(d => {
      setProfile(d);
      setProfileForm({ name: d.name, email: d.email });
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileAlert(null);
    setSavingProfile(true);
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: profileForm.name, email: profileForm.email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setProfileAlert({ type: 'error', message: data.error || 'Failed to save' });
    } else {
      setProfile(p => p ? { ...p, name: profileForm.name, email: profileForm.email } : null);
      setProfileAlert({ type: 'success', message: 'Profile updated successfully' });
    }
    setSavingProfile(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwAlert(null);
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwAlert({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    if (pwForm.new_password.length < 6) {
      setPwAlert({ type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }
    setSavingPw(true);
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwAlert({ type: 'error', message: data.error || 'Failed to change password' });
    } else {
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwAlert({ type: 'success', message: 'Password changed successfully' });
    }
    setSavingPw(false);
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-lg space-y-5">
        <h1 className="text-2xl font-medium text-gray-900">Account Settings</h1>

        {/* Profile card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <User size={18} className="text-primary-700" />
            </div>
            <div>
              <h2 className="font-medium text-gray-900">Profile Information</h2>
              <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} required className="field-outlined" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} required className="field-outlined" />
            </div>
            {profileAlert && <Alert {...profileAlert} />}
            <button type="submit" disabled={savingProfile} className="btn-filled w-full">
              {savingProfile ? <Spinner /> : null}
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <Lock size={18} className="text-primary-700" />
            </div>
            <h2 className="font-medium text-gray-900">Change Password</h2>
          </div>

          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
              <input type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} required autoComplete="current-password" className="field-outlined" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <input type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} required autoComplete="new-password" minLength={6} className="field-outlined" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input type="password" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} required autoComplete="new-password" className="field-outlined" />
            </div>
            {pwAlert && <Alert {...pwAlert} />}
            <button type="submit" disabled={savingPw} className="btn-filled w-full">
              {savingPw ? <Spinner /> : null}
              {savingPw ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function Alert({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm border-2 ${
      type === 'success'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {message}
    </div>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
