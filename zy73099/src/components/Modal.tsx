import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'warning' | 'danger';
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  variant = 'default',
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 flex w-full max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 animate-[scaleIn_0.18s_ease-out]',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
          size === 'xl' && 'max-w-4xl',
          variant === 'warning' && 'ring-orange-400/40 shadow-orange-500/20',
          variant === 'danger' && 'ring-rose-400/40 shadow-rose-500/20'
        )}
      >
        {(title || variant !== 'default') && (
          <div
            className={cn(
              'flex items-center justify-between border-b px-6 py-4',
              variant === 'warning' && 'border-orange-100 bg-orange-50/60',
              variant === 'danger' && 'border-rose-100 bg-rose-50/60'
            )}
          >
            <div className="flex-1 pr-4">{title}</div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="关闭"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.2} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
