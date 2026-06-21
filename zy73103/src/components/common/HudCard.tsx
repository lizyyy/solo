import type { HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface HudCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: ReactNode;
  accent?: 'blue' | 'orange' | 'red' | 'green' | 'none';
  children: ReactNode;
}

const accentMap: Record<NonNullable<HudCardProps['accent']>, string> = {
  blue: 'border-blue-500/50 shadow-[0_0_20px_-8px_rgba(59,130,246,0.6)]',
  orange:
    'border-amber-500/50 shadow-[0_0_20px_-8px_rgba(245,158,11,0.6)]',
  red: 'border-red-500/60 shadow-[0_0_22px_-8px_rgba(239,68,68,0.7)]',
  green:
    'border-emerald-500/50 shadow-[0_0_20px_-8px_rgba(16,185,129,0.6)]',
  none: 'border-slate-700/60',
};

export default function HudCard({
  title,
  icon,
  accent = 'blue',
  className,
  children,
  ...rest
}: HudCardProps) {
  return (
    <div
      {...rest}
      className={twMerge(
        'relative rounded-[6px] border bg-slate-900/70 backdrop-blur-sm',
        'before:absolute before:inset-0 before:rounded-[6px] before:pointer-events-none before:bg-gradient-to-br before:from-white/5 before:to-transparent',
        accentMap[accent],
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -top-px left-3 right-3 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(148,163,184,0.45), transparent)',
        }}
      />
      {title && (
        <div className="flex items-center gap-2 border-b border-slate-700/50 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {icon}
          <span>{title}</span>
          <span
            className="ml-auto font-mono text-[10px] text-slate-600"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            · HUD ·
          </span>
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
