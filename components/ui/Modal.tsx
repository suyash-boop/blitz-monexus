'use client';

import { Fragment, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'w-full glass-elevated rounded-2xl shadow-2xl shadow-black/40',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-glass-border">
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className={cn('px-6 py-4', !title && 'pt-6')}>
            {children}
          </div>
        </div>
      </div>
    </Fragment>
  );
}

export default Modal;
