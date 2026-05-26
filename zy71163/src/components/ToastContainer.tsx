import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastMessage } from '@/types';
import { cn } from '@/lib/utils';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const ToastIcon = ({ type }: { type: ToastMessage['type'] }) => {
  const icons = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <XCircle className="text-red-500" size={20} />,
    warning: <AlertTriangle className="text-orange-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />
  };
  return icons[type];
};

const bgColors: Record<ToastMessage['type'], string> = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-orange-50 border-orange-200',
  info: 'bg-blue-50 border-blue-200'
};

export const ToastContainer = memo(function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-96 max-w-[calc(100vw-2rem)]">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex items-start gap-3 p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm',
              bgColors[toast.type]
            )}
          >
            <ToastIcon type={toast.type} />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 text-sm">{toast.title}</h4>
              <p className="text-sm text-gray-700 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
