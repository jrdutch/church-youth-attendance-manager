'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import GlobalSearch from '@/components/GlobalSearch';
import { APP_NAME } from '@/config';
import {
  LayoutDashboard, Users, CalendarCheck,
  ShieldCheck, Menu, X, LogOut, ChevronDown, UserCog,
  BarChart3, ScrollText, UserPlus, Award, DatabaseBackup, Mail
} from 'lucide-react';

interface NavProps {
  user: { name: string; email: string; role: string };
}

const navLinks = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/students',   label: 'Students',   icon: Users },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/service',    label: 'Service',    icon: Award },
  { href: '/reports',    label: 'Reports',    icon: BarChart3 },
];

const adminLinks = [
  { href: '/admin/users',   label: 'Users',     icon: ShieldCheck },
  { href: '/admin/groups',  label: 'Groups',    icon: Users },
  { href: '/admin/guests',  label: 'Guests',    icon: UserPlus },
  { href: '/admin/import',  label: 'Import CSV', icon: Users },
  { href: '/admin/backups', label: 'Backups',   icon: DatabaseBackup },
  { href: '/admin/summary', label: 'Weekly Email', icon: Mail },
  { href: '/admin/audit',   label: 'Audit Log', icon: ScrollText },
];

export default function Navbar({ user }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="bg-primary-700 text-white shadow-el3 sticky top-0 z-40">
      {/* MD3 gold accent line */}
      <div className="h-1 bg-gold-400 w-full" />

      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">

          {/* ── Leading: logo + title ── */}
          <Link href="/dashboard" className="flex items-center gap-3 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Logo"
              width={36}
              height={36}
              className="rounded-full shadow-el1"
            />
            <span className="font-medium text-base tracking-tight hidden sm:block select-none">
              {APP_NAME}
            </span>
          </Link>

          {/* ── Center: desktop nav links ── */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isActive(href)
                    ? 'bg-white/20 text-white shadow-el1'
                    : 'text-primary-100 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}

            {/* Admin dropdown */}
            {user.role === 'admin' && (
              <div className="relative">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                    ${pathname.startsWith('/admin')
                      ? 'bg-white/20 text-white shadow-el1'
                      : 'text-primary-100 hover:bg-white/10 hover:text-white'}`}
                >
                  <ShieldCheck size={16} />
                  Admin
                  <ChevronDown size={13} className={`transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                </button>
                {adminOpen && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-2xl shadow-el3 z-50 py-2 overflow-hidden">
                    {adminLinks.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setAdminOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-surface-container transition-colors"
                      >
                        <Icon size={15} className="text-primary-500" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* ── Trailing: user info + actions ── */}
          <div className="flex items-center gap-1">
            <GlobalSearch />
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-gold-400 capitalize">{user.role}</p>
            </div>
            <Link
              href="/account"
              title="My Account"
              className={`btn-icon text-primary-100 hover:text-white hidden md:flex
                ${isActive('/account') ? 'bg-white/20' : ''}`}
            >
              <UserCog size={18} />
            </Link>
            <button
              onClick={logout}
              title="Sign out"
              className="btn-icon text-primary-100 hover:text-white hidden md:flex"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn-icon text-primary-100 hover:text-white md:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-primary-900">
          <div className="pt-3">
            <GlobalSearch variant="mobile" />
          </div>
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors
                  ${isActive(href)
                    ? 'bg-white/20 text-white'
                    : 'text-primary-100 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}

            {user.role === 'admin' && (
              <>
                <div className="px-4 pt-2 pb-1">
                  <p className="text-xs font-medium text-primary-400 uppercase tracking-wider">Admin</p>
                </div>
                {adminLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors
                      ${isActive(href)
                        ? 'bg-white/20 text-white'
                        : 'text-primary-100 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </>
            )}

            <div className="border-t border-white/10 mt-2 pt-2">
              <div className="flex items-center gap-3 px-4 py-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold">
                  {user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gold-400 capitalize">{user.role}</p>
                </div>
              </div>
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-primary-100 hover:bg-white/10 transition-colors"
              >
                <UserCog size={18} /> My Account
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-primary-100 hover:bg-white/10 w-full transition-colors"
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
