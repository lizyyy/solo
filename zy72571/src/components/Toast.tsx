import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const iconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const colorMap = {
  success: 'bg-success-500/20 border-success-500/50 text-success-400',
  warning: 'bg-warning-500/20 border-warning-500/50 text-warning-400',
  error: 'bg-danger-500/20 border-danger-500/50 text-danger-400',
  info: 'bg-primary-500/20 border-primary-500/50 text-primary-400',
};

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast, index) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg animate-slide-in ${colorMap[toast.type]}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Icon size={18} />
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
