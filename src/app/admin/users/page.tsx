'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import { toast, confirmDialog } from '@/components/Toast';
import {
  UserPlus, Edit, Trash2, Shield, CheckSquare, Square,
  Ban, CheckCircle, KeyRound, ChevronDown, ChevronRight
} from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  is_active: number;
  created_at: string;
}

interface Group {
  id: number;
  name: string;
  color: string;
  parent_id?: number;
}

interface Permission {
  user_id: number;
  group_id: number;
  can_view_medical: number;
  can_view_contacts: number;
  can_edit_students: number;
  can_take_attendance: number;
  group_name?: string;
  group_color?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [managePermsUser, setManagePermsUser] = useState<User | null>(null);
  const [resetPwUser, setResetPwUser] = useState<User | null>(null);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'staff', is_active: 1 });
  const [resetPwForm, setResetPwForm] = useState({ password: '', confirm: '' });
  const [resetPwError, setResetPwError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/groups').then(r => r.json()),
    ]).then(([u, g]) => {
      setUsers(Array.isArray(u) ? u : []);
      const arr: Group[] = Array.isArray(g) ? g : [];
      setGroups(arr);
      // Auto-expand parents that have children
      const parentIds = new Set(arr.filter(x => x.parent_id).map(x => x.parent_id as number));
      setExpandedParents(parentIds);
    }).finally(() => setLoading(false));
  }, []);

  // ── Add user ──────────────────────────────────────────────────
  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setUsers(prev => [...prev, {
      id: data.id, name: addForm.name, email: addForm.email,
      role: addForm.role as 'admin' | 'staff', is_active: 1,
      created_at: new Date().toISOString(),
    }]);
    setShowAddModal(false);
    setAddForm({ name: '', email: '', password: '', role: 'staff' });
    setSaving(false);
  }

  // ── Edit user (name, email, role only) ───────────────────────
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === editUser.id ? {
        ...u, name: editForm.name, email: editForm.email,
        role: editForm.role as 'admin' | 'staff',
      } : u));
      setEditUser(null);
      toast.success('User updated');
    } else {
      toast.error('Could not save changes');
    }
    setSaving(false);
  }

  // ── Block / Unblock ──────────────────────────────────────────
  async function toggleBlock(user: User) {
    const newActive = user.is_active ? 0 : 1;
    const label = newActive ? 'Unblock' : 'Block';
    const ok = await confirmDialog({
      title: `${label} ${user.name}?`,
      message: newActive
        ? 'They will be able to sign in again.'
        : 'They will no longer be able to sign in until unblocked.',
      confirmLabel: label,
      destructive: !newActive,
    });
    if (!ok) return;
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newActive }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newActive } : u));
      toast.success(`${user.name} ${newActive ? 'unblocked' : 'blocked'}`);
    } else {
      toast.error(`Could not ${label.toLowerCase()} user`);
    }
  }

  // ── Reset password ───────────────────────────────────────────
  async function doResetPw(e: React.FormEvent) {
    e.preventDefault();
    setResetPwError('');
    if (resetPwForm.password !== resetPwForm.confirm) {
      setResetPwError('Passwords do not match');
      return;
    }
    if (resetPwForm.password.length < 6) {
      setResetPwError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/users/${resetPwUser!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPwForm.password }),
    });
    if (res.ok) {
      setResetPwUser(null);
      setResetPwForm({ password: '', confirm: '' });
      toast.success('Password reset');
    } else {
      setResetPwError('Could not reset password — please try again');
    }
    setSaving(false);
  }

  // ── Delete user ──────────────────────────────────────────────
  async function deleteUser(u: User) {
    const ok = await confirmDialog({
      title: `Delete ${u.name}?`,
      message: 'This permanently removes their account and cannot be undone. If you just want to stop them signing in, use Block instead.',
      confirmLabel: 'Delete Permanently',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success(`${u.name} deleted`);
    } else {
      toast.error('Could not delete user');
    }
  }

  // ── Permissions ──────────────────────────────────────────────
  async function openPerms(user: User) {
    setManagePermsUser(user);
    const data = await fetch(`/api/users/${user.id}/permissions`).then(r => r.json());
    setPermissions(Array.isArray(data) ? data : []);
  }

  async function toggleGroupAccess(groupId: number, enabled: boolean) {
    if (!managePermsUser) return;
    if (!enabled) {
      const res = await fetch(`/api/users/${managePermsUser.id}/permissions`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (!res.ok) { toast.error('Could not update access'); return; }
      setPermissions(prev => prev.filter(p => p.group_id !== groupId));
    } else {
      const group = groups.find(g => g.id === groupId);
      const res = await fetch(`/api/users/${managePermsUser.id}/permissions`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, can_view_medical: 0, can_view_contacts: 1, can_edit_students: 0, can_take_attendance: 1 }),
      });
      if (!res.ok) { toast.error('Could not update access'); return; }
      setPermissions(prev => [...prev, {
        user_id: managePermsUser.id, group_id: groupId,
        can_view_medical: 0, can_view_contacts: 1, can_edit_students: 0, can_take_attendance: 1,
        group_name: group?.name, group_color: group?.color,
      }]);
    }
  }

  async function grantAllSubGroups(parentId: number, grant: boolean) {
    const children = groups.filter(g => g.parent_id === parentId);
    for (const c of children) {
      const hasAccess = !!permissions.find(p => p.group_id === c.id);
      if (grant && !hasAccess) await toggleGroupAccess(c.id, true);
      if (!grant && hasAccess) await toggleGroupAccess(c.id, false);
    }
  }

  async function updatePerm(groupId: number, field: string, value: number) {
    if (!managePermsUser) return;
    const existing = permissions.find(p => p.group_id === groupId);
    if (!existing) return;
    const updated = { ...existing, [field]: value };
    const res = await fetch(`/api/users/${managePermsUser.id}/permissions`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated, group_id: groupId }),
    });
    if (!res.ok) { toast.error('Could not update permission'); return; }
    setPermissions(prev => prev.map(p => p.group_id === groupId ? updated : p));
  }

  const topLevelGroups = groups.filter(g => !g.parent_id);
  const subGroupsOf = (pid: number) => groups.filter(g => g.parent_id === pid);
  const toggleExpand = (id: number) => setExpandedParents(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ─────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-900">User Management</h1>
          <button onClick={() => setShowAddModal(true)} className="btn-filled">
            <UserPlus size={16} /> Add User
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
          </div>
        ) : (
          <div className="card divide-y divide-outline-variant/30">
            {users.map(u => (
              <div key={u.id} className={`flex items-center gap-4 px-5 py-4 ${!u.is_active ? 'opacity-55' : ''}`}>
                <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 text-primary-700 font-medium text-sm">
                  {u.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-surface-container text-gray-600'
                    }`}>{u.role}</span>
                    {!u.is_active && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Blocked</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {u.role !== 'admin' && (
                    <button onClick={() => openPerms(u)} title="Manage Permissions" className="btn-icon text-primary-500 w-9 h-9">
                      <Shield size={16} />
                    </button>
                  )}
                  <button onClick={() => { setResetPwUser(u); setResetPwForm({ password: '', confirm: '' }); setResetPwError(''); }}
                    title="Reset Password" className="btn-icon text-amber-500 w-9 h-9">
                    <KeyRound size={16} />
                  </button>
                  <button onClick={() => { setEditUser(u); setEditForm({ name: u.name, email: u.email, role: u.role, is_active: u.is_active }); }}
                    title="Edit" className="btn-icon text-gray-400 hover:text-gray-700 w-9 h-9">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => toggleBlock(u)} title={u.is_active ? 'Block' : 'Unblock'}
                    className={`btn-icon w-9 h-9 ${u.is_active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}>
                    {u.is_active ? <Ban size={16} /> : <CheckCircle size={16} />}
                  </button>
                  <button onClick={() => deleteUser(u)} title="Delete" className="btn-icon text-red-400 hover:text-red-600 w-9 h-9">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <Modal title="Add User" onClose={() => setShowAddModal(false)}>
          <form onSubmit={addUser} className="space-y-4">
            <FormField label="Full Name" value={addForm.name} onChange={v => setAddForm(p => ({ ...p, name: v }))} required />
            <FormField label="Email Address" type="email" value={addForm.email} onChange={v => setAddForm(p => ({ ...p, email: v }))} required />
            <FormField label="Password" type="password" value={addForm.password} onChange={v => setAddForm(p => ({ ...p, password: v }))} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))} className="field-outlined bg-white cursor-pointer">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border-2 border-red-200 px-4 py-3 rounded-2xl">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1">
                {saving ? <Spinner /> : null}{saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <Modal title="Edit User" onClose={() => setEditUser(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <FormField label="Full Name" value={editForm.name} onChange={v => setEditForm(p => ({ ...p, name: v }))} required />
            <FormField label="Email Address" type="email" value={editForm.email} onChange={v => setEditForm(p => ({ ...p, email: v }))} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} className="field-outlined bg-white cursor-pointer">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1">
                {saving ? <Spinner /> : null}{saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Reset Password Modal ── */}
      {resetPwUser && (
        <Modal title={`Reset Password — ${resetPwUser.name}`} onClose={() => setResetPwUser(null)}>
          <form onSubmit={doResetPw} className="space-y-4">
            <p className="text-sm text-gray-500">Enter a new password for <strong>{resetPwUser.name}</strong>.</p>
            <FormField label="New Password" type="password" value={resetPwForm.password} onChange={v => setResetPwForm(p => ({ ...p, password: v }))} required />
            <FormField label="Confirm Password" type="password" value={resetPwForm.confirm} onChange={v => setResetPwForm(p => ({ ...p, confirm: v }))} required />
            {resetPwError && <p className="text-sm text-red-600 bg-red-50 border-2 border-red-200 px-4 py-3 rounded-2xl">{resetPwError}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setResetPwUser(null)} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1 bg-amber-500 hover:bg-amber-600">
                {saving ? <Spinner /> : null}{saving ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Permissions Modal ── */}
      {managePermsUser && (
        <Modal title={`Permissions — ${managePermsUser.name}`} onClose={() => setManagePermsUser(null)} size="xl">
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-1">
              Turn on a group to let this person see its students, then choose what
              they&apos;re allowed to do. A typical teacher needs <strong>Take Attendance</strong> and{' '}
              <strong>View Parent Contacts</strong> for just their own class.
            </p>

            {topLevelGroups.map(g => {
              const children = subGroupsOf(g.id);
              const hasChildren = children.length > 0;
              const perm = permissions.find(p => p.group_id === g.id);
              const hasAccess = !!perm;
              const expanded = expandedParents.has(g.id);

              // For parent groups with children: show "grant all" toggle
              // For leaf groups: show individual access toggle
              if (hasChildren) {
                const grantedChildren = children.filter(c => !!permissions.find(p => p.group_id === c.id));
                const allGranted = grantedChildren.length === children.length;
                const someGranted = grantedChildren.length > 0;

                return (
                  <div key={g.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Parent header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                      <button onClick={() => toggleExpand(g.id)} className="flex items-center gap-2 flex-1 text-left">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="font-medium text-gray-900 text-sm">{g.name}</span>
                        <span className="text-xs text-gray-400">
                          ({grantedChildren.length}/{children.length} sub-groups)
                        </span>
                        {expanded ? <ChevronDown size={14} className="text-gray-400 ml-auto" /> : <ChevronRight size={14} className="text-gray-400 ml-auto" />}
                      </button>
                      {/* Grant All toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{allGranted ? 'All granted' : someGranted ? 'Partial' : 'No access'}</span>
                        <div
                          onClick={() => grantAllSubGroups(g.id, !allGranted)}
                          className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${
                            allGranted ? 'bg-primary-600' : someGranted ? 'bg-primary-300' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow mt-1 transition-transform mx-1 ${allGranted ? 'translate-x-4' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* Sub-groups */}
                    {expanded && (
                      <div className="divide-y divide-gray-100">
                        {children.map(c => {
                          const cp = permissions.find(p => p.group_id === c.id);
                          const cHas = !!cp;
                          return (
                            <div key={c.id} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 pl-4">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                  <span className="text-sm font-medium text-gray-800">{c.name}</span>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <span className="text-xs text-gray-500">{cHas ? 'Access' : 'No access'}</span>
                                  <div onClick={() => toggleGroupAccess(c.id, !cHas)}
                                    className={`w-9 h-5 rounded-full transition-colors cursor-pointer ${cHas ? 'bg-primary-600' : 'bg-gray-300'}`}>
                                    <div className={`w-3 h-3 rounded-full bg-white shadow mt-1 transition-transform mx-1 ${cHas ? 'translate-x-4' : ''}`} />
                                  </div>
                                </label>
                              </div>
                              {cHas && (
                                <div className="grid grid-cols-2 gap-1.5 pl-4">
                                  {permFields.map(([field, label, hint]) => {
                                    const val = cp[field as keyof Permission] as number;
                                    return (
                                      <label key={field} title={hint} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                        <button type="button" onClick={() => updatePerm(c.id, field, val ? 0 : 1)}>
                                          {val ? <CheckSquare size={14} className="text-primary-500" /> : <Square size={14} className="text-gray-300" />}
                                        </button>
                                        <span className={val ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Leaf group (no children)
              return (
                <div key={g.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                      <h3 className="font-medium text-gray-900 text-sm">{g.name}</h3>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-gray-500">{hasAccess ? 'Access granted' : 'No access'}</span>
                      <div onClick={() => toggleGroupAccess(g.id, !hasAccess)}
                        className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${hasAccess ? 'bg-primary-600' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow mt-1 transition-transform mx-1 ${hasAccess ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  </div>
                  {hasAccess && (
                    <div className="grid grid-cols-2 gap-2">
                      {permFields.map(([field, label, hint]) => {
                        const val = perm[field as keyof Permission] as number;
                        return (
                          <label key={field} className="flex items-start gap-2 text-sm cursor-pointer">
                            <button type="button" className="mt-0.5" onClick={() => updatePerm(g.id, field, val ? 0 : 1)}>
                              {val ? <CheckSquare size={16} className="text-primary-500" /> : <Square size={16} className="text-gray-300" />}
                            </button>
                            <span>
                              <span className={`block ${val ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                              <span className="block text-xs text-gray-400">{hint}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

const permFields: [string, string, string][] = [
  ['can_take_attendance', 'Take Attendance', 'Check students in and out'],
  ['can_view_contacts', 'View Parent Contacts', 'See parent & emergency phone numbers'],
  ['can_view_medical', 'View Medical Info', 'See allergies and medical conditions'],
  ['can_edit_students', 'Edit Student Records', 'Change student profiles and medical info'],
];

function FormField({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="field-outlined" />
    </div>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}
