import { useUIStore } from '@/store/useUIStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-neon-green/20 border-neon-green/50 text-neon-green',
  error: 'bg-neon-pink/20 border-neon-pink/50 text-neon-pink',
  warning: 'bg-neon-yellow/20 border-neon-yellow/50 text-neon-yellow',
  info: 'bg-neon-blue/20 border-neon-blue/50 text-neon-blue',
};

export function Toast() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`animate-slide-up flex items-center gap-3 px-4 py-3 rounded-lg border ${colorMap[toast.type]} backdrop-blur-md min-w-[300px]`}
          >
            <Icon size={20} />
            <span className="flex-1 font-body text-sm">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="hover:opacity-70 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
