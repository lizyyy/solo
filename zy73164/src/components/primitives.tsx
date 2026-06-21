import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BoundarySeverity, EmptySetFlag, RunStatus } from '@/types';

export function Card({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: 'accent' | 'alert';
}) {
  return (
    <div
      className={cn(
        'panel p-4',
        glow === 'accent' && 'shadow-glow-accent',
        glow === 'alert' && 'shadow-glow-alert',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{children}</h3>
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </div>
  );
}

export function Tag({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'alert' | 'warn';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/[0.03] text-ink-300',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    ok: 'border-ok/30 bg-ok/10 text-ok',
    alert: 'border-alert/30 bg-alert/10 text-alert',
    warn: 'border-warn/30 bg-warn/10 text-warn',
  };
  return (
    <span
      className={cn(
        'mono inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: 'ok' | 'accent' | 'alert' | 'warn' | 'muted' }) {
  const map: Record<string, string> = {
    ok: 'bg-ok',
    accent: 'bg-accent',
    alert: 'bg-alert',
    warn: 'bg-warn',
    muted: 'bg-ink-400',
  };
  return <span className={cn('inline-block h-2 w-2 rounded-full', map[tone])} />;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-accent text-ink-950 hover:bg-accent/90 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset]',
    subtle: 'bg-white/[0.04] text-ink-200 hover:bg-white/[0.08] border border-white/10',
    ghost: 'text-ink-300 hover:text-ink-100 hover:bg-white/[0.05]',
    danger: 'bg-alert/15 text-alert border border-alert/30 hover:bg-alert/25',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-sm px-3 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  tone = 'neutral',
  mono = true,
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'alert' | 'warn';
  mono?: boolean;
}) {
  const tones: Record<string, string> = {
    neutral: 'text-ink-100',
    accent: 'text-accent',
    ok: 'text-ok',
    alert: 'text-alert',
    warn: 'text-warn',
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className={cn('text-lg leading-tight', mono && 'mono', tones[tone])}>{value}</span>
    </div>
  );
}

export function statusMeta(status: RunStatus): { tone: 'ok' | 'accent' | 'alert' | 'warn'; label: string } {
  switch (status) {
    case 'pass':
      return { tone: 'ok', label: '通过' };
    case 'override':
      return { tone: 'accent', label: '人工改判' };
    case 'fail':
      return { tone: 'alert', label: '未通过' };
    case 'pending_review':
      return { tone: 'warn', label: '待复核' };
  }
}

export function emptyMeta(flag: EmptySetFlag): { tone: 'ok' | 'alert' | 'neutral'; label: string } {
  switch (flag) {
    case 'EMPTY_ANOMALY':
      return { tone: 'alert', label: '空集合异常' };
    case 'NORMAL_EMPTY':
      return { tone: 'neutral', label: '正常空输入' };
    default:
      return { tone: 'ok', label: '有历史答案' };
  }
}

export function severityMeta(s: BoundarySeverity): { tone: 'alert' | 'warn'; label: string } {
  return s === 'zero_boundary' || s === 'div_zero'
    ? { tone: 'alert', label: '除零边界' }
    : { tone: 'warn', label: '近零' };
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-white/[0.06]', className)} />;
}
