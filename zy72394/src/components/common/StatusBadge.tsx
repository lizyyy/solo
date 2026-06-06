import { getStatusLabel, getStatusColor } from '@/utils/helpers';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        getStatusColor(status),
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current"></span>
      {getStatusLabel(status)}
    </span>
  );
}
