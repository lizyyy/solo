import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  danger?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  danger,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setMounted(true));
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    setMounted(false);
  }, [open, onClose]);

  if (!open) return null;

  const w = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={cn(
          'absolute inset-0 bg-navy-900/50 backdrop-blur-sm transition-opacity',
          mounted ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 w-full bg-white shadow-2xl border-2 border-navy-500 transition-all',
          w,
          danger && 'border-fire-500',
          mounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95',
        )}
      >
        <div
          className={cn(
            'px-5 py-4 border-b-2 flex items-start justify-between',
            danger ? 'bg-fire-50 border-fire-200' : 'bg-navy-50 border-navy-100',
          )}
        >
          <div>
            <h3
              className={cn(
                'font-song font-bold text-lg',
                danger ? 'text-fire-700' : 'text-navy-700',
              )}
            >
              {title}
            </h3>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-500 hover:text-navy-700 hover:bg-white/70 transition"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t-2 border-ink-100 bg-ink-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
