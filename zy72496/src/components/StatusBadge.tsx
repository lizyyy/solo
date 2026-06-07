import { RecordStatus, STATUS_LABELS, STATUS_COLORS } from '@/types';
import { AlertTriangle, CheckCircle, XCircle, Clock, Eye, UserCheck, Shield } from 'lucide-react';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const STATUS_ICONS: Record<RecordStatus, React.ReactNode> = {
  [RecordStatus.PENDING]: <Clock className="w-3 h-3" />,
  [RecordStatus.REVIEWING]: <AlertTriangle className="w-3 h-3" />,
  [RecordStatus.PLANNER_DONE]: <UserCheck className="w-3 h-3" />,
  [RecordStatus.INSPECTOR_DONE]: <Shield className="w-3 h-3" />,
  [RecordStatus.NORMAL]: <CheckCircle className="w-3 h-3" />,
  [RecordStatus.PROBLEM]: <XCircle className="w-3 h-3" />,
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const icon = STATUS_ICONS[status];
  const label = STATUS_LABELS[status];
  const colorClass = STATUS_COLORS[status];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${colorClass} ${sizeClass}`}
    >
      {icon}
      {label}
    </span>
  );
}
