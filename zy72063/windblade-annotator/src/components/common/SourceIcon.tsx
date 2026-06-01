import { Map, Tablet, FileSpreadsheet, Image } from 'lucide-react';
import type { SourceType } from '../../types';
import { SOURCE_LABELS } from '../../types';

interface SourceIconProps {
  source: SourceType;
  showLabel?: boolean;
  className?: string;
}

const SOURCE_ICONS: Record<SourceType, typeof Map> = {
  gis: Map,
  tablet: Tablet,
  excel: FileSpreadsheet,
  screenshot: Image
};

const SOURCE_COLORS: Record<SourceType, string> = {
  gis: 'text-blue-400',
  tablet: 'text-green-400',
  excel: 'text-emerald-400',
  screenshot: 'text-amber-400'
};

export const SourceIcon = ({ source, showLabel = false, className = '' }: SourceIconProps) => {
  const Icon = SOURCE_ICONS[source];
  const colorClass = SOURCE_COLORS[source];
  const label = SOURCE_LABELS[source];

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Icon className={`w-4 h-4 ${colorClass}`} />
      {showLabel && <span className="text-xs text-gray-300">{label}</span>}
    </div>
  );
};
