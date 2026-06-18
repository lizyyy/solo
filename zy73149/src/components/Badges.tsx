import type { AnomalyType, SedimentLevel, DataSource } from '@/types';
import { getSedimentLevelLabel, getSedimentLevelColor } from '@/utils/sediment';

type AnomalyBadgeType = Exclude<AnomalyType, 'none'>;

interface AnomalyBadgeProps {
  type: AnomalyType;
}

export function AnomalyBadge({ type }: AnomalyBadgeProps) {
  if (type === 'none') return null;

  const labelMap: Record<AnomalyBadgeType, string> = {
    cloudCover: '云遮挡',
    missingData: '数据缺失',
    outOfRange: '超出范围',
  };

  const colorMap: Record<AnomalyBadgeType, string> = {
    cloudCover: 'bg-gray-200 text-gray-700',
    missingData: 'bg-yellow-100 text-yellow-700',
    outOfRange: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colorMap[type]} animate-pulse-slow`}
    >
      {labelMap[type]}
    </span>
  );
}

interface SedimentLevelBadgeProps {
  level: SedimentLevel;
}

export function SedimentLevelBadge({ level }: SedimentLevelBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${getSedimentLevelColor(level)}`}
    >
      {getSedimentLevelLabel(level)}
    </span>
  );
}

interface SourceBadgeProps {
  source: DataSource;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const label = source === 'buoy' ? '浮标' : '遥感';
  const color =
    source === 'buoy'
      ? 'bg-ocean-100 text-ocean-700'
      : 'bg-purple-100 text-purple-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${color}`}>
      {label}
    </span>
  );
}
