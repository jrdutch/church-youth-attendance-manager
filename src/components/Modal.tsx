'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export default function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* MD3 scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* MD3 Dialog surface — 28px radius */}
      <div className={`relative bg-white rounded-3xl shadow-el4 w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}>
        {/* Dialog header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-xl font-medium text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="btn-icon text-gray-500 hover:text-gray-700 -mr-1"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-outline-variant mx-6" />

        {/* Dialog content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
