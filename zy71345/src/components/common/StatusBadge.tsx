import { cn } from '../../lib/utils';

type StatusType = 'error' | 'warning' | 'info' | 'success' | 'open' | 'resolved' | 'ignored';

interface StatusBadgeProps {
  status: StatusType;
  children?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusClasses: Record<StatusType, string> = {
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    open: 'bg-orange-100 text-orange-700 border-orange-200',
    resolved: 'bg-green-100 text-green-700 border-green-200',
    ignored: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const statusLabels: Record<StatusType, string> = {
    error: '错误',
    warning: '警告',
    info: '信息',
    success: '成功',
    open: '待处理',
    resolved: '已解决',
    ignored: '已忽略',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusClasses[status],
        className
      )}
    >
      {children || statusLabels[status]}
    </span>
  );
}
