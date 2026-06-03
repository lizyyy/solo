import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-2xl bg-primary-800 border-2 border-primary-600',
        className
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-primary-600">
          <h3 className="font-mono text-sm font-semibold text-primary-200 tracking-wider">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-primary-400 hover:text-primary-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}
