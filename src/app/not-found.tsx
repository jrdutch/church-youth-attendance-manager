import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container p-6">
      <div className="bg-white rounded-2xl shadow-el3 p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔍</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500 mt-2">
          This page doesn&apos;t exist or may have been moved.
        </p>
        <Link href="/dashboard" className="btn-filled w-full flex items-center justify-center gap-2 mt-6">
          <Home size={16} /> Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
