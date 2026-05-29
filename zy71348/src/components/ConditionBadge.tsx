import type { ConditionGrade } from '@/types';
import { CONDITION_GRADES } from '@/types';

interface ConditionBadgeProps {
  condition: ConditionGrade;
}

const conditionColors: Record<ConditionGrade, string> = {
  'M': 'bg-vinyl-700 text-white',
  'NM': 'bg-vinyl-500 text-white',
  'EX': 'bg-green-600 text-white',
  'VG+': 'bg-green-500 text-white',
  'VG': 'bg-caramel-400 text-vinyl-900',
  'G': 'bg-caramel-300 text-vinyl-900',
  'F': 'bg-alert-500 text-white',
  'P': 'bg-gray-500 text-white',
};

export function ConditionBadge({ condition }: ConditionBadgeProps) {
  const grade = CONDITION_GRADES.find((g) => g.value === condition);
  return (
    <span className={`status-badge ${conditionColors[condition]}`}>
      {grade?.label || condition}
    </span>
  );
}
