import { RecordStatus, statusLabels, statusColors } from '../types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  return (
    <span className={`badge ${statusColors[status]}`}>
      {statusLabels[status]}
    </span>
  );
};

export default StatusBadge;
