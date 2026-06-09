import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useCollisionStore } from '@/store/useCollisionStore';

export function Toast() {
  const { toast, actions } = useCollisionStore();
  if (!toast) return null;
  const cfg = {
    success: { icon: CheckCircle2, ring: 'ring-emerald-400/30', iconC: 'text-emerald-500', bg: 'from-emerald-50 to-white border-emerald-200' },
    error: { icon: XCircle, ring: 'ring-rose-400/30', iconC: 'text-rose-500', bg: 'from-rose-50 to-white border-rose-200' },
    info: { icon: Info, ring: 'ring-blue-400/30', iconC: 'text-brand-500', bg: 'from-blue-50 to-white border-blue-200' },
  }[toast.type];
  const Icon = cfg.icon;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 animate-[slideIn_.25s_ease-out]">
      <div className={`bg-gradient-to-br ${cfg.bg} border rounded-lg shadow-xl shadow-slate-900/10 ring-1 ${cfg.ring} p-4 flex items-start gap-3`}>
        <Icon className={`w-5 h-5 mt-0.5 ${cfg.iconC} flex-shrink-0`} />
        <div className="flex-1 text-sm text-slate-700 font-medium leading-snug">{toast.message}</div>
        <button
          onClick={actions.dismissToast}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
