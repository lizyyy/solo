import type { Priority } from '@/types';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: {
    label: '高优先级',
    className: 'bg-red-50 text-red-700 border-l-4 border-l-red-600',
  },
  medium: {
    label: '中优先级',
    className: 'bg-amber-50 text-amber-700 border-l-4 border-l-amber-600',
  },
  low: {
    label: '低优先级',
    className: 'bg-green-50 text-green-700 border-l-4 border-l-green-600',
  },
};

export default function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
