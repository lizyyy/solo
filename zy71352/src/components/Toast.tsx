import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { cn } from '../lib/utils';

const toastStyles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

export function Toast() {
  const { toast, hideToast } = useUIStore();
  const Icon = toastIcons[toast.type];

  if (!toast.open) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slideIn">
      <div
        className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-72 max-w-md',
        toastStyles[toast.type]
      )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="flex-1 text-sm font-medium">{toast.message}</p>
        <button
          onClick={hideToast}
          className="p-0.5 rounded hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
