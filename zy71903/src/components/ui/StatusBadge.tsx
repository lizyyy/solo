import { Check, Clock, AlertTriangle, Edit3 } from 'lucide-react';
import { RecordStatus } from '../../types';
import { summaryService } from '../../services/SummaryService';

interface StatusBadgeProps {
  status: RecordStatus;
  showIcon?: boolean;
}

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const label = summaryService.getStatusLabel(status);

  const iconMap: Record<RecordStatus, React.ReactNode> = {
    [RecordStatus.CONFIRMED]: <Check className="w-3 h-3" />,
    [RecordStatus.PENDING]: <Clock className="w-3 h-3" />,
    [RecordStatus.TO_FILL]: <AlertTriangle className="w-3 h-3" />,
    [RecordStatus.MANUAL_EDITED]: <Edit3 className="w-3 h-3" />,
  };

  const classMap: Record<RecordStatus, string> = {
    [RecordStatus.CONFIRMED]: 'status-confirmed',
    [RecordStatus.PENDING]: 'status-pending',
    [RecordStatus.TO_FILL]: 'status-tofill',
    [RecordStatus.MANUAL_EDITED]: 'status-manual',
  };

  return (
    <span className={`status-badge ${classMap[status]}`}>
      {showIcon && iconMap[status]}
      {label}
    </span>
  );
}
