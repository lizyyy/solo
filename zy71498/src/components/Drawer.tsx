import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function Drawer({ isOpen, onClose, title, children, className }: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-deep-blue-900/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md bg-deep-blue-700/95 backdrop-blur-md border-l border-deep-blue-400/20 shadow-2xl animate-slide-in-right',
          className
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-deep-blue-400/20">
          <h2 className="font-display font-bold text-xl text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-deep-blue-600/50 transition-colors text-deep-blue-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto h-[calc(100%-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
