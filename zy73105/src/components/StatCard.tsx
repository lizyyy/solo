import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  hint?: string;
}

const toneMap = {
  default: 'from-slate-50 to-slate-100 text-slate-900',
  success: 'from-emerald-50 to-emerald-100 text-emerald-700',
  warning: 'from-amber-50 to-amber-100 text-amber-700',
  danger: 'from-rose-50 to-rose-100 text-rose-700',
  accent: 'from-orange-50 to-orange-100 text-orange-700',
} as const;

const iconToneMap = {
  default: 'bg-slate-900/10',
  success: 'bg-emerald-500/15',
  warning: 'bg-amber-500/15',
  danger: 'bg-rose-500/15',
  accent: 'bg-orange-500/15',
} as const;

export function StatCard({ label, value, icon, tone = 'default', hint }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br ${toneMap[tone]} p-5 shadow-sm animate-fade-in-stagger`}
    >
      <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-[11px] opacity-70">{hint}</div>}
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconToneMap[tone]}`}>
        {icon}
      </div>
    </div>
    </div>
  );
}
