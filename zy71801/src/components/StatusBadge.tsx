import { cn } from '../lib/utils';
import { getStatusText, getConclusionText } from '../utils/judgmentEngine';

interface StatusBadgeProps {
  status: string;
  type?: 'pack' | 'judgment';
}

export function StatusBadge({ status, type = 'pack' }: StatusBadgeProps) {
  const displayText = type === 'judgment' 
    ? getConclusionText(status) 
    : getStatusText(status);

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    parsing: 'bg-blue-100 text-blue-700',
    parsed: 'bg-blue-100 text-blue-700',
    judging: 'bg-yellow-100 text-yellow-700',
    judged: 'bg-warning-100 text-warning-600',
    reviewing: 'bg-warning-100 text-warning-600',
    completed: 'bg-success-100 text-success-600',
    archived: 'bg-gray-100 text-gray-600',
    normal: 'bg-success-100 text-success-600',
    need_supplement: 'bg-danger-100 text-danger-500',
    need_review: 'bg-warning-100 text-warning-600',
    abnormal: 'bg-danger-100 text-danger-500'
  };

  return (
    <span className={cn(
      'status-badge',
      statusColors[status] || 'bg-gray-100 text-gray-700'
    )}>
      {displayText}
    </span>
  );
}
