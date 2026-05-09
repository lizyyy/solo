import { statusMap, type ReviewStatus } from '../types';

interface Props {
  status: ReviewStatus;
}

function StatusBadge({ status }: Props) {
  const info = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  
  return (
    <span className={`badge ${info.color}`}>
      {info.label}
    </span>
  );
}

export default StatusBadge;
