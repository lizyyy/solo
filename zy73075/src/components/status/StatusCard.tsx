import { cn } from '@/lib/utils';

export type StatusColor = 'emerald' | 'amber' | 'rose' | 'slate' | 'violet' | 'sky';

interface StatusCardProps {
  title: string;
  count: number;
  color: StatusColor;
  active?: boolean;
  onClick?: () => void;
}

const borderColorMap: Record<StatusColor, string> = {
  emerald: 'border-emerald-500',
  amber: 'border-amber-500',
  rose: 'border-rose-500',
  slate: 'border-slate-500',
  violet: 'border-violet-500',
  sky: 'border-sky-500',
};

const textColorMap: Record<StatusColor, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  slate: 'text-slate-400',
  violet: 'text-violet-400',
  sky: 'text-sky-400',
};

const activeBgMap: Record<StatusColor, string> = {
  emerald: 'bg-emerald-500/10',
  amber: 'bg-amber-500/10',
  rose: 'bg-rose-500/10',
  slate: 'bg-slate-500/10',
  violet: 'bg-violet-500/10',
  sky: 'bg-sky-500/10',
};

export default function StatusCard({ title, count, color, active = false, onClick }: StatusCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'card w-full text-left transition-all duration-150',
        'border-l-4',
        borderColorMap[color],
        active && activeBgMap[color],
        onClick && 'cursor-pointer hover:bg-slate-800/50 active:translate-y-px'
      )}
    >
      <div className="px-4 py-3">
        <p className="text-sm text-slate-400">{title}</p>
        <p className={cn('mt-1 font-mono text-3xl font-semibold tracking-tight', textColorMap[color])}>
          {count}
        </p>
      </div>
    </button>
  );
}
