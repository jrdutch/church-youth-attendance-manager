'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

// ── Public API ───────────────────────────────────────────────────
// Usable from any client component, no provider/context needed:
//   toast.success('Saved!');
//   toast.error('Could not save');
//   const ok = await confirmDialog({ title: 'Delete?', message: '…', destructive: true });

type ToastKind = 'success' | 'error' | 'info';

export const toast = {
  success: (message: string) => dispatch('success', message),
  error:   (message: string) => dispatch('error', message),
  info:    (message: string) => dispatch('info', message),
};

function dispatch(kind: ToastKind, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { kind, message } }));
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('app-confirm', { detail: { options, resolve } }));
  });
}

// ── Renderer (mounted once in root layout) ──────────────────────

interface ToastItem { id: number; kind: ToastKind; message: string; }
interface ConfirmState { options: ConfirmOptions; resolve: (ok: boolean) => void; }

let nextId = 1;

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const { kind, message } = (e as CustomEvent).detail;
      const id = nextId++;
      setToasts(prev => [...prev.slice(-3), { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    }
    function onConfirm(e: Event) {
      const { options, resolve } = (e as CustomEvent).detail;
      setConfirm({ options, resolve });
    }
    window.addEventListener('app-toast', onToast);
    window.addEventListener('app-confirm', onConfirm);
    return () => {
      window.removeEventListener('app-toast', onToast);
      window.removeEventListener('app-confirm', onConfirm);
    };
  }, [remove]);

  function answerConfirm(ok: boolean) {
    confirm?.resolve(ok);
    setConfirm(null);
  }

  const icons: Record<ToastKind, React.ReactNode> = {
    success: <CheckCircle size={18} className="text-green-500 flex-shrink-0" />,
    error:   <AlertCircle size={18} className="text-red-500 flex-shrink-0" />,
    info:    <Info size={18} className="text-blue-500 flex-shrink-0" />,
  };

  return (
    <>
      {/* Toast stack */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border animate-toast-in bg-white
              ${t.kind === 'success' ? 'border-green-200' : t.kind === 'error' ? 'border-red-200' : 'border-blue-200'}`}
            role="status"
          >
            {icons[t.kind]}
            <p className="text-sm text-gray-800 flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => answerConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-el3 p-6 max-w-sm w-full animate-toast-in">
            <div className="flex items-start gap-3">
              {confirm.options.destructive && (
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
              )}
              <div>
                <h2 className="font-semibold text-gray-900">{confirm.options.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{confirm.options.message}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => answerConfirm(false)} className="btn-outlined flex-1">
                {confirm.options.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => answerConfirm(true)}
                className={`flex-1 px-4 py-2 rounded-full text-sm font-medium text-white transition-colors
                  ${confirm.options.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-500 hover:bg-primary-700'}`}
              >
                {confirm.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
