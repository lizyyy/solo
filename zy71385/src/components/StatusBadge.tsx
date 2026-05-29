import type { FlagStatus } from '../types';

interface StatusBadgeProps {
  status: FlagStatus;
}

const labelMap: Record<FlagStatus, string> = {
  active: '运行中',
  inactive: '已停用',
  deprecated: '已废弃',
  pending_cleanup: '待清理',
};

const colorMap: Record<FlagStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
  deprecated: 'bg-orange-50 text-orange-700 border-orange-200',
  pending_cleanup: 'bg-primary-50 text-primary-700 border-primary-200',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge border ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}
