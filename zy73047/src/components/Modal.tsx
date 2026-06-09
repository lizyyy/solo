import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  dismissable?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-2xl w-full',
  dismissable = true,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className={cn(
          'absolute inset-0 bg-slate-900/50 backdrop-blur-sm',
          dismissable && 'animate-[fadeIn_.15s_ease]'
        )}
        onClick={() => dismissable && onClose()}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'bg-white border border-slate-200 shadow-2xl rounded-lg pointer-events-auto',
            widthClass,
            'animate-[popIn_.18s_ease]'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
            <div className="font-semibold text-slate-800">{title}</div>
            {dismissable && (
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 rounded-b-lg flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
