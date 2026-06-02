import type { RecordStatus } from '@shared/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const STATUS_CONFIG: Record<RecordStatus, { label: string; className: string; icon: string }> = {
  pending: { label: '待处理', className: 'status-pending', icon: '⏳' },
  processed: { label: '已处理', className: 'status-processed', icon: '✓' },
  verify: { label: '待核实', className: 'status-verify', icon: '⚠' },
  onsite: { label: '需要现场复看', className: 'status-onsite', icon: '📍' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={config.className}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
