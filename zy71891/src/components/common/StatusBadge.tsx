import { WarningStatus } from '../../types';

interface StatusBadgeProps {
  status: WarningStatus;
}

const statusConfig: Record<WarningStatus, { label: string; className: string }> = {
  normal: {
    label: '正常',
    className: 'bg-green-900/30 text-green-400 border border-green-700/50',
  },
  warning: {
    label: '预警',
    className: 'bg-orange-900/30 text-orange-400 border border-orange-700/50',
  },
  fault: {
    label: '故障',
    className: 'bg-red-900/30 text-red-400 border border-red-700/50',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${config.className}`}>
      {config.label}
    </span>
  );
}
