'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import { toast, confirmDialog } from '@/components/Toast';
import { Plus, Edit, Trash2, Users, ChevronDown, ChevronRight } from 'lucide-react';

interface Group {
  id: number;
  name: string;
  description?: string;
  type: string;
  color: string;
  parent_id?: number;
  is_active: number;
}

const GROUP_COLORS = [
  '#4263eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6b7280',
];

const GROUP_TYPES = [
  { value: 'youth',       label: 'Youth Ministry' },
  { value: 'elementary',  label: 'Elementary / Religious Ed' },
  { value: 'nursery',     label: 'Nursery / Toddler' },
  { value: 'general',     label: 'General' },
];

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());

  const emptyForm = { name: '', description: '', type: 'general', color: '#4263eb', parent_id: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch('/api/groups').then(r => r.json()).then((g: Group[]) => {
      const arr = Array.isArray(g) ? g : [];
      setGroups(arr);
      const parentIds = new Set(arr.filter(x => x.parent_id).map(x => x.parent_id as number));
      setExpandedParents(parentIds);
    }).finally(() => setLoading(false));
  }, []);

  const topLevel = groups.filter(g => !g.parent_id);
  const subGroupsOf = (pid: number) => groups.filter(g => g.parent_id === pid);

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id ? Number(form.parent_id) : undefined };
      const res = await fetch('/api/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      setGroups(prev => [...prev, { id, ...payload, is_active: 1 }]);
      setShowAdd(false); setForm(emptyForm);
      toast.success('Group created');
    } catch {
      toast.error('Could not create group — please try again');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editGroup) return;
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id ? Number(form.parent_id) : null };
      const res = await fetch(`/api/groups/${editGroup.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setGroups(prev => prev.map(g => g.id === editGroup.id
        ? { ...g, ...payload, parent_id: payload.parent_id ?? undefined } : g));
      setEditGroup(null);
      toast.success('Group saved');
    } catch {
      toast.error('Could not save group — please try again');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(id: number) {
    const children = subGroupsOf(id);
    const name = groups.find(g => g.id === id)?.name;
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      message: children.length > 0
        ? `This will also delete its ${children.length} sub-group${children.length !== 1 ? 's' : ''}. Students in these groups will become unassigned.`
        : 'Students in this group will become unassigned.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const childIds = new Set(children.map(c => c.id));
      setGroups(prev => prev.filter(g => g.id !== id && !childIds.has(g.id)));
      toast.success('Group deleted');
    } else {
      toast.error('Could not delete group');
    }
  }

  function openEdit(g: Group) {
    setEditGroup(g);
    setForm({ name: g.name, description: g.description || '', type: g.type, color: g.color, parent_id: g.parent_id ? String(g.parent_id) : '' });
  }

  function toggleExpand(id: number) {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-900">Ministry Groups</h1>
          <button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="btn-filled">
            <Plus size={16} /> Add Group
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {topLevel.map(g => {
              const children = subGroupsOf(g.id);
              const expanded = expandedParents.has(g.id);
              return (
                <div key={g.id} className="card overflow-hidden">
                  {/* Parent row */}
                  <div className="p-4 flex items-center gap-4">
                    {children.length > 0 ? (
                      <button onClick={() => toggleExpand(g.id)}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
                        style={{ backgroundColor: g.color + '20' }}>
                        {expanded
                          ? <ChevronDown size={18} style={{ color: g.color }} />
                          : <ChevronRight size={18} style={{ color: g.color }} />}
                      </button>
                    ) : (
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: g.color + '20' }}>
                        <Users size={18} style={{ color: g.color }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900">{g.name}</h3>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="text-xs text-gray-400 bg-surface-container px-2.5 py-0.5 rounded-full capitalize">
                          {GROUP_TYPES.find(t => t.value === g.type)?.label || g.type}
                        </span>
                        {children.length > 0 && (
                          <span className="text-xs text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full">
                            {children.length} sub-group{children.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {g.description && <p className="text-sm text-gray-500 mt-0.5">{g.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(g)} className="btn-icon text-gray-400 hover:text-primary-600"><Edit size={16} /></button>
                      <button onClick={() => deleteGroup(g.id)} className="btn-icon text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  {/* Sub-groups */}
                  {expanded && children.length > 0 && (
                    <div className="border-t border-outline-variant/40 divide-y divide-outline-variant/30 bg-surface-container/50">
                      {children.map(c => (
                        <div key={c.id} className="flex items-center gap-4 pl-16 pr-4 py-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: c.color + '25' }}>
                            <Users size={13} style={{ color: c.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{c.name}</p>
                            {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(c)} className="btn-icon text-gray-400 hover:text-primary-600 w-8 h-8"><Edit size={13} /></button>
                            <button onClick={() => deleteGroup(c.id)} className="btn-icon text-gray-400 hover:text-red-500 w-8 h-8"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                      <div className="pl-16 pr-4 py-2.5">
                        <button
                          onClick={() => { setForm({ ...emptyForm, parent_id: String(g.id), type: g.type, color: g.color }); setShowAdd(true); }}
                          className="btn-text px-3 py-1.5 text-xs"
                        >
                          <Plus size={13} /> Add sub-group
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {topLevel.length === 0 && (
              <div className="card py-14 text-center text-gray-400">
                No groups yet — add one to get started
              </div>
            )}
          </div>
        )}
      </div>

      {(showAdd || editGroup) && (
        <Modal title={editGroup ? 'Edit Group' : 'Add Group'} onClose={() => { setShowAdd(false); setEditGroup(null); }}>
          <form onSubmit={editGroup ? saveEdit : addGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Group Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="field-outlined" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2} className="field-outlined resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Group (optional)</label>
              <select value={form.parent_id} onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))} className="field-outlined bg-white cursor-pointer">
                <option value="">— Top-level group —</option>
                {topLevel.filter(g => !editGroup || g.id !== editGroup.id).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="field-outlined bg-white cursor-pointer">
                {GROUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap items-center">
                {GROUP_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    className={`w-9 h-9 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-9 h-9 rounded-full border-0 cursor-pointer" title="Custom color" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowAdd(false); setEditGroup(null); }} className="btn-outlined flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-filled flex-1">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {saving ? 'Saving…' : (editGroup ? 'Save Changes' : 'Create Group')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
