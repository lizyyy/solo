import { DeductionStatus, STATUS_LABELS } from '../../shared/types';

interface StatusBadgeProps {
  status: DeductionStatus;
}

const statusColors: Record<DeductionStatus, string> = {
  [DeductionStatus.DRAFT]: 'bg-gray-100 text-gray-700 border-gray-200',
  [DeductionStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
  [DeductionStatus.CONFIRMED]: 'bg-blue-50 text-blue-700 border-blue-200',
  [DeductionStatus.APPEALING]: 'bg-orange-50 text-orange-700 border-orange-200',
  [DeductionStatus.ADJUSTED]: 'bg-purple-50 text-purple-700 border-purple-200',
  [DeductionStatus.CLOSED]: 'bg-green-50 text-green-700 border-green-200',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};

export default StatusBadge;
