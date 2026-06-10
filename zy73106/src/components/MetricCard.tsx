import { cn } from '@/lib/utils';

type MetricTone = 'steel' | 'red' | 'orange' | 'green' | 'yellow';

interface MetricCardProps {
  label: string;
  value: number | string;
  tone?: MetricTone;
  icon?: React.ReactNode;
  onClick?: () => void;
  hint?: string;
}

const toneMap: Record<MetricTone, { border: string; accent: string; bg: string }> = {
  steel: { border: 'border-steel-500', accent: 'text-steel-200', bg: 'bg-steel-700/40' },
  red: { border: 'border-[#C0392B]', accent: 'text-[#E74C3C]', bg: 'bg-[#7B241C]/30' },
  orange: { border: 'border-[#E67E22]', accent: 'text-[#F39C12]', bg: 'bg-[#784212]/30' },
  green: { border: 'border-[#27AE60]', accent: 'text-[#2ECC71]', bg: 'bg-[#186A3B]/30' },
  yellow: { border: 'border-[#F1C40F]', accent: 'text-[#F1C40F]', bg: 'bg-[#7D6608]/30' },
};

export default function MetricCard({
  label,
  value,
  tone = 'steel',
  icon,
  onClick,
  hint,
}: MetricCardProps) {
  const t = toneMap[tone];
  return (
    <div
      className={cn(
        'panel-bordered p-4 relative overflow-hidden transition-all duration-200',
        onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-lg',
        t.border,
        t.bg,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={cn('text-xs font-mono uppercase tracking-wider text-steel-400 mb-2')}>
            {label}
          </div>
          <div className={cn('text-3xl font-display font-bold animate-number-pop', t.accent)}>
            {value}
          </div>
          {hint && (
            <div className="text-[10px] font-mono text-steel-500 mt-1">{hint}</div>
          )}
        </div>
        {icon && <div className={cn('opacity-60', t.accent)}>{icon}</div>}
      </div>
      <div className={cn('absolute bottom-0 left-0 right-0 h-[2px]', t.accent.replace('text-', 'bg-'))} />
    </div>
  );
}
