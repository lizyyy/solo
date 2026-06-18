import type { WaterQualityRecord } from '@/types';
import { StatusBadge, ParameterBadge } from '@/components/common/Badges';
import { AlertTriangle, FileText } from 'lucide-react';

interface RecordCardProps {
  record: WaterQualityRecord;
  selected?: boolean;
  onClick?: () => void;
}

export default function RecordCard({ record, selected, onClick }: RecordCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
        selected
          ? 'bg-ocean-700/50 border-nautical-warning shadow-glow-orange'
          : 'bg-ocean-800/50 border-ocean-700 hover:bg-ocean-700/30 hover:border-ocean-600'
      } ${record.hasSupplementaryNote ? 'corner-fold' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <ParameterBadge type={record.parameterType} />
          {record.hasDrift && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-nautical-warning/20 text-nautical-warning animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              漂移
            </span>
          )}
        </div>
        <StatusBadge status={record.status} size="sm" />
      </div>

      <div className="mb-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-white font-mono">
            {record.cleanedValue.toFixed(2)}
          </span>
          <span className="text-sm text-ocean-400">{record.unit}</span>
        </div>
        <div className="text-xs text-ocean-500 line-through">
          原始: {record.rawValue.toFixed(2)} {record.unit}
        </div>
      </div>

      <div className="text-sm text-ocean-300 mb-2">
        <span className="font-medium">{record.shipName}</span>
        <span className="mx-2 text-ocean-600">·</span>
        <span>{record.location}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-ocean-500">
        <span>{record.measureDate} {record.measureTime}</span>
        <span className="font-mono">{record.recordNo}</span>
      </div>

      {record.hasSupplementaryNote && (
        <div className="mt-3 pt-3 border-t border-ocean-700/50">
          <div className="flex items-start gap-2 text-xs text-nautical-warning/80">
            <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">后补备注: {record.supplementaryNote}</span>
          </div>
        </div>
      )}
    </div>
  );
}
