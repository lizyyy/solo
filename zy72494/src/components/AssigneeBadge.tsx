import { ASSIGNEE_LABELS } from '../types';
import { User } from 'lucide-react';

interface AssigneeBadgeProps {
  assignee: string;
}

export default function AssigneeBadge({ assignee }: AssigneeBadgeProps) {
  const colors: Record<string, string> = {
    zhoujie: 'bg-blue-50 text-blue-700',
    traffic: 'bg-orange-50 text-orange-700',
    grid: 'bg-green-50 text-green-700',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[assignee] || 'bg-gray-50 text-gray-700'}`}>
      <User className="w-3 h-3" />
      {ASSIGNEE_LABELS[assignee] || assignee}
    </span>
  );
}
