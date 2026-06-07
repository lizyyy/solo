import { RecordStatus, STATUS_CONFIG } from '../types';

interface StatusBadgeProps {
  status: RecordStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.color}`}>
      {config.label}
    </span>
  );
}
