import React from 'react';
import { RemittanceStatus } from '../../types';
import { getStatusLabel } from '../../utils/format';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: RemittanceStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = {
    [RemittanceStatus.NORMAL]: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: CheckCircle,
      dot: 'bg-emerald-500'
    },
    [RemittanceStatus.ABNORMAL]: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: AlertTriangle,
      dot: 'bg-red-500'
    },
    [RemittanceStatus.PENDING]: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: Clock,
      dot: 'bg-amber-500'
    }
  };

  const { bg, text, border, icon: Icon, dot } = config[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md border font-medium',
      bg, text, border, sizeClasses
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {getStatusLabel(status)}
    </span>
  );
};
