import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  className?: string;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  className,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const variantStyles = {
    danger: {
      icon: 'text-red-500 bg-red-50',
      confirm: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
    },
    warning: {
      icon: 'text-amber-500 bg-amber-50',
      confirm: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
    },
    info: {
      icon: 'text-blue-500 bg-blue-50',
      confirm: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20',
    },
  };

  const styles = variantStyles[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
              className
            )}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('p-3 rounded-xl', styles.icon)}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {title}
                </h3>

                {message && (
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {message}
                  </p>
                )}
                {children}
              </div>

              <div className="flex gap-3 p-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all shadow-md hover:shadow-lg',
                    styles.confirm
                  )}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
