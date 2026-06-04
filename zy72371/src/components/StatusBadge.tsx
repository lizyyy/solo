import { BatchStatus } from '../types';
import { getStatusLabel, getStatusColor } from '../utils';

interface StatusBadgeProps {
  status: BatchStatus;
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm'
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium text-white
        ${getStatusColor(status)} ${sizeClasses[size]}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-white/60 mr-1.5 ${size === 'sm' ? 'w-1 h-1' : ''}`}></span>
      {getStatusLabel(status)}
    </span>
  );
};

export default StatusBadge;
