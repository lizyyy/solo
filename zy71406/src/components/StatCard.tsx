import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: 'primary' | 'accent' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}

const colorClasses: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
  accent: 'bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100',
  warning: 'bg-conflict-date/10 text-conflict-date border-conflict-date/30 hover:bg-conflict-date/20',
  danger: 'bg-conflict-withdrawn/10 text-conflict-withdrawn border-conflict-withdrawn/30 hover:bg-conflict-withdrawn/20',
  success: 'bg-success-500/10 text-success-600 border-success-500/30 hover:bg-success-500/20',
};

export default function StatCard({ label, value, icon: Icon, color, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card card-hover p-4 flex items-center gap-4 cursor-pointer transition-all',
        onClick && colorClasses[color]
      )}
    >
      <div className={cn('p-3 rounded-lg', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-neutral-600">{label}</p>
        <p className="text-2xl font-display font-semibold text-neutral-900 tabular-nums">
          {value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
