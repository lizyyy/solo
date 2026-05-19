import { cn, getStatusColor, getStatusText } from '@/utils';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      getStatusColor(status)
    )}>
      {getStatusText(status)}
    </span>
  );
}
