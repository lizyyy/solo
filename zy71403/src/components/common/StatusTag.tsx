import type { RecordStatus } from '../../types';
import { getStatusLabel, getStatusColors } from '../../utils/statusFlow';

interface StatusTagProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function StatusTag({ status, size = 'md', showDot = true }: StatusTagProps) {
  const colors = getStatusColors(status);
  const label = getStatusLabel(status);
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md ${colors.bg} ${colors.text} ${colors.border} border font-medium ${sizeClasses[size]}`}
    >
      {showDot && (
        <span className={`w-2 h-2 rounded-full ${colors.dot} ${status === 'pending' ? 'animate-pulse-soft' : ''}`} />
      )}
      {label}
    </span>
  );
}
