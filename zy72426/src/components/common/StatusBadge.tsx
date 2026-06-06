import { cn } from '@/lib/utils';
import type { RecordStatus, ReviewStatus } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
  pending: {
    label: '待处理',
    className: 'bg-gray-100 text-gray-700',
  },
  reviewing: {
    label: '待复核',
    className: 'bg-amber-100 text-amber-700',
  },
  confirmed: {
    label: '已确认',
    className: 'bg-green-100 text-green-700',
  },
  exception: {
    label: '异常',
    className: 'bg-red-100 text-red-700',
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
  className?: string;
}

const reviewStatusConfig: Record<ReviewStatus, { label: string; className: string }> = {
  pending: {
    label: '待复核',
    className: 'bg-amber-100 text-amber-700',
  },
  confirmed: {
    label: '已确认',
    className: 'bg-green-100 text-green-700',
  },
  rejected: {
    label: '已拒绝',
    className: 'bg-gray-100 text-gray-500',
  },
};

export const ReviewStatusBadge = ({ status, className }: ReviewStatusBadgeProps) => {
  const config = reviewStatusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
