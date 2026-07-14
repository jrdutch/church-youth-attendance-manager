'use client';

import { RefreshCw, Home } from 'lucide-react';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container p-6">
      <div className="bg-white rounded-2xl shadow-el3 p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">😅</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500 mt-2">
          Don&apos;t worry — your data is safe. Try reloading the page.
        </p>
        <div className="mt-6 space-y-2">
          <button onClick={reset} className="btn-filled w-full flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Try Again
          </button>
          <a href="/dashboard" className="btn-outlined w-full flex items-center justify-center gap-2">
            <Home size={16} /> Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
