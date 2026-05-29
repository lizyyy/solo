import { AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import { getConflictLabel, getConflictClass } from '@/utils/format';
import type { ConflictType } from '@/types';

interface ConflictBadgeProps {
  type: ConflictType;
  showIcon?: boolean;
  showLabel?: boolean;
}

const iconMap: Record<ConflictType, typeof AlertTriangle> = {
  exercise_date_mismatch: AlertTriangle,
  withdrawn_still_in_list: XCircle,
  insufficient_position: AlertCircle,
};

export default function ConflictBadge({ type, showIcon = true, showLabel = true }: ConflictBadgeProps) {
  const className = getConflictClass(type);
  const label = getConflictLabel(type);
  const Icon = iconMap[type];

  return (
    <span className={`${className} gap-1`}>
      {showIcon && <Icon className="w-3 h-3" />}
      {showLabel && label}
    </span>
  );
}
