'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { ScrollText, RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  created_at: string;
}

function actionColor(action: string): string {
  if (action === 'check_in') return 'bg-green-100 text-green-700';
  if (action === 'check_out') return 'bg-teal-100 text-teal-700';
  if (action.startsWith('student')) return 'bg-blue-100 text-blue-700';
  if (action.startsWith('user') || action.startsWith('auth')) return 'bg-purple-100 text-purple-700';
  if (action.startsWith('family')) return 'bg-orange-100 text-orange-700';
  if (action.startsWith('group')) return 'bg-indigo-100 text-indigo-700';
  return 'bg-gray-100 text-gray-600';
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit?limit=500');
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLogs(); }, []);

  const filtered = logs.filter(l => {
    if (!filter) return true;
    const haystack = [l.action, l.user_name, l.entity_type, l.details].join(' ').toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-medium text-gray-900 flex items-center gap-2">
              <ScrollText size={24} className="text-primary-500" /> Audit Log
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">All system actions, newest first</p>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="btn-outlined flex items-center gap-2 text-sm px-4 py-2"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant/40">
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by action, user, entity..."
              className="field-outlined w-full sm:w-80 text-sm"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <ScrollText size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{logs.length === 0 ? 'No audit log entries yet' : 'No entries match your filter'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">When</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString([], {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColor(entry.action)}`}>
                          {actionLabel(entry.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {entry.user_name || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {entry.entity_type && (
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                            {entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-sm truncate" title={entry.details}>
                        {entry.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-right">
              Showing {filtered.length} of {logs.length} entries
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
