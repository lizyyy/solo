import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn, getStatusText } from '@/utils/helpers';
import type { RewardStatus } from '@/types';

interface StatusPillProps {
  status: RewardStatus;
  className?: string;
}

const statusConfig: Record<RewardStatus, { icon: React.ElementType; color: string; dotColor: string }> = {
  confirmed: {
    icon: CheckCircle2,
    color: 'bg-green-50 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
  },
  pending: {
    icon: Clock,
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dotColor: 'bg-yellow-500',
  },
  manual: {
    icon: AlertTriangle,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-500',
  },
  missed: {
    icon: XCircle,
    color: 'bg-red-50 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
  },
};

export default function StatusPill({ status, className }: StatusPillProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:shadow-sm',
        config.color,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      <Icon className="w-3.5 h-3.5" />
      <span>{getStatusText(status)}</span>
    </span>
  );
}
