import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface NotificationToastProps {
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  isVisible: boolean;
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    progressColor: 'bg-green-500',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    progressColor: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    progressColor: 'bg-blue-500',
  },
};

export default function NotificationToast({
  type,
  message,
  description,
  duration = 4000,
  isVisible,
  onClose,
}: NotificationToastProps) {
  const [progress, setProgress] = useState(100);
  const config = toastConfig[type];

  useEffect(() => {
    if (!isVisible || duration === 0) return;

    setProgress(100);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible, duration, onClose]);

  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: '100%', scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: '100%', scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'relative overflow-hidden rounded-xl border shadow-lg backdrop-blur-md',
            'min-w-[320px] max-w-md',
            config.bgColor,
            config.borderColor
          )}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
              >
                <Icon className={cn('w-6 h-6 flex-shrink-0', config.iconColor)} />
              </motion.div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-vinyl-100">{message}</p>
                {description && (
                  <p className="mt-1 text-sm text-vinyl-400">{description}</p>
                )}
              </div>

              <button
                onClick={onClose}
                className="flex-shrink-0 p-1 rounded-lg text-vinyl-400 hover:text-vinyl-100 hover:bg-vinyl-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {duration > 0 && (
            <div className="h-1 bg-vinyl-800/50">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.05, ease: 'linear' }}
                className={cn('h-full', config.progressColor)}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: ToastType;
    message: string;
    description?: string;
    duration?: number;
  }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          description={toast.description}
          duration={toast.duration}
          isVisible={true}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
