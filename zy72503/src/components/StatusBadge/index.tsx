import type { ConflictStatus, AssigneeRole, ReviewStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ConflictStatus | ReviewStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string; dotClass: string }> = {
  pending: {
    label: '待复核',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  reviewing: {
    label: '处理中',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  resolved: {
    label: '已解决',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  dismissed: {
    label: '已忽略',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  open: {
    label: '待处理',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  in_progress: {
    label: '进行中',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  completed: {
    label: '已完成',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotClass)} />
      {config.label}
    </span>
  );
}

interface RoleBadgeProps {
  role: AssigneeRole;
  size?: 'sm' | 'md';
}

const roleConfig: Record<AssigneeRole, { label: string; className: string }> = {
  operator: {
    label: '运营复核人',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  annotator: {
    label: '标注负责人',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  product: {
    label: '产品经理',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
};

export function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const config = roleConfig[role];
  
  return (
    <span
      className={cn(
        'inline-flex items-center border rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
