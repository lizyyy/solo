import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function Toast() {
  const { toast, dismissToast } = useAppStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 4000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const meta = {
    success: {
      icon: CheckCircle2,
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      iconColor: 'text-emerald-400',
    },
    warn: {
      icon: AlertTriangle,
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/15',
      text: 'text-amber-300',
      iconColor: 'text-amber-400',
    },
    error: {
      icon: XCircle,
      border: 'border-red-500/40',
      bg: 'bg-red-500/15',
      text: 'text-red-300',
      iconColor: 'text-red-400',
    },
  }[toast.type];

  const Icon = meta.icon;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top fade-in">
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border backdrop-blur-md shadow-xl ${meta.border} ${meta.bg}`}
      >
        <Icon size={17} className={meta.iconColor} />
        <span className={`text-sm font-medium ${meta.text}`}>{toast.message}</span>
        <button
          onClick={dismissToast}
          className={`ml-1 p-0.5 rounded hover:bg-white/10 ${meta.iconColor}`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
