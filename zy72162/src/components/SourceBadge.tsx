import { SourceType, sourceTypeLabels } from '@/types';
import { cn } from '@/utils/cn';
import { Map, Users, Camera, Building2 } from 'lucide-react';

interface SourceBadgeProps {
  type: SourceType;
  className?: string;
}

const sourceIcons = {
  [SourceType.GIS]: Map,
  [SourceType.RESIDENT]: Users,
  [SourceType.INSPECTION]: Camera,
  [SourceType.STREET]: Building2,
};

const sourceColors = {
  [SourceType.GIS]: 'bg-blue-50 text-blue-700 border-blue-200',
  [SourceType.RESIDENT]: 'bg-purple-50 text-purple-700 border-purple-200',
  [SourceType.INSPECTION]: 'bg-amber-50 text-amber-700 border-amber-200',
  [SourceType.STREET]: 'bg-teal-50 text-teal-700 border-teal-200',
};

export default function SourceBadge({ type, className }: SourceBadgeProps) {
  const Icon = sourceIcons[type];
  return (
    <span className={cn('badge', sourceColors[type], className)}>
      <Icon size={12} className="mr-1" />
      {sourceTypeLabels[type]}
    </span>
  );
}
