import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'right' | 'bottom';
  widthClass?: string;
}

export default function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  widthClass = 'w-[640px] max-w-[90vw]',
}: Props) {
  if (!open) return null;
  const isBottom = side === 'bottom';
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute bg-white shadow-2xl border border-slate-200',
          isBottom
            ? 'bottom-0 left-0 right-0 h-[70vh] rounded-t-xl animate-[slideUp_.2s_ease]'
            : cn('top-0 right-0 bottom-0 rounded-l-xl animate-[slideInRight_.2s_ease]', widthClass)
        )}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10">
          <div className="font-semibold text-slate-800 text-[15px]">{title}</div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-200/80 transition-colors text-slate-500 hover:text-slate-800"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className={cn(isBottom ? 'h-[calc(70vh-52px)]' : 'h-[calc(100%-52px)]', 'overflow-auto')}>
          {children}
        </div>
      </div>
    </div>
  );
}
