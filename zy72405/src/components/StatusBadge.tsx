import { RecordStatus } from '@/types';
import { AlertTriangle, CheckCircle, Clock, XCircle, Eye, Music } from 'lucide-react';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<RecordStatus, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  pending: {
    label: '待处理',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    icon: <Clock className="w-3 h-3" />
  },
  alias_mapped: {
    label: '已匹配别名',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    icon: <Music className="w-3 h-3" />
  },
  review_needed: {
    label: '待巡演统筹复核',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: <AlertTriangle className="w-3 h-3" />
  },
  confirmed: {
    label: '已确认',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: <CheckCircle className="w-3 h-3" />
  },
  reviewed: {
    label: '已复核',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800',
    icon: <Eye className="w-3 h-3" />
  },
  rejected: {
    label: '已驳回',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: <XCircle className="w-3 h-3" />
  }
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-sm gap-1.5';

  return (
    <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium ${config.bgColor} ${config.textColor} transition-colors`}>
      {config.icon}
      {config.label}
    </span>
  );
}
