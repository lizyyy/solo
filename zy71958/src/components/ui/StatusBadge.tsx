import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: 'pending_review' | 'reviewed' | 'pending_processing' | 'resolved' | 'open' | 'in_progress';
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_review: {
    label: '待复核',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  },
  reviewed: {
    label: '已复核',
    className: 'bg-green-500/20 text-green-400 border-green-500/50',
  },
  pending_processing: {
    label: '待处理',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  },
  resolved: {
    label: '已解决',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  },
  open: {
    label: '待处理',
    className: 'bg-red-500/20 text-red-400 border-red-500/50',
  },
  in_progress: {
    label: '处理中',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending_review;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded',
        config.className,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current animate-pulse" />
      {config.label}
    </span>
  );
}
