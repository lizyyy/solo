import { DollarSign, Calendar, Users } from 'lucide-react';
import { impactLevelColor } from '@/utils/heatmap';

interface ImpactBadgeProps {
  type: 'budget' | 'schedule' | 'roster';
  level: 'none' | 'low' | 'medium' | 'high';
}

export default function ImpactBadge({ type, level }: ImpactBadgeProps) {
  const Icon = type === 'budget' ? DollarSign : type === 'schedule' ? Calendar : Users;
  const color = impactLevelColor(level);

  if (level === 'none') return null;

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{ backgroundColor: `${color}20`, color: color }}
    >
      <Icon className="w-3 h-3" />
      <span className="font-medium capitalize">{type}</span>
    </div>
  );
}
