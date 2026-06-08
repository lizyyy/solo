import { useReviewStore } from '@/store/reviewStore.js';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

const cfg: Record<string, { bg: string; border: string; text: string; Icon: any }> = {
  success: { bg: 'bg-brand-50', border: 'border-brand-300/60', text: 'text-brand-700', Icon: CheckCircle2 },
  warning: { bg: 'bg-accent-300/20', border: 'border-accent-400/50', text: 'text-accent-500', Icon: AlertTriangle },
  error: { bg: 'bg-warn-500/10', border: 'border-warn-400/50', text: 'text-warn-600', Icon: XCircle },
  info: { bg: 'bg-ink-100', border: 'border-ink-200', text: 'text-ink-700', Icon: Info },
};

export function ToastContainer() {
  const toasts = useReviewStore(s => s.toasts);
  const dismiss = useReviewStore(s => s.dismissToast);

  useEffect(() => {
    // noop
  }, [toasts.length]);

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-2.5 w-[360px] max-w-[calc(100vw-40px)] pointer-events-none">
      {toasts.map(t => {
        const c = cfg[t.type] || cfg.info;
        const Icon = c.Icon;
        return (
          <div key={t.id}
            className={`pointer-events-auto animate-slide-down rounded-2xl border-2 shadow-lg ${c.bg} ${c.border} ${c.text} p-3.5 flex items-start gap-3`}>
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className={`shrink-0 ${c.text} opacity-60 hover:opacity-100 transition`}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
