import React from 'react';
import {
  FileText,
  ClipboardList,
  Wrench,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import type { AnalysisConclusion, SourceType } from '@/types';
import { SOURCE_TYPE_LABELS } from '@/types';
import { formatDateTime, getLevelColor, getLevelLabel } from '@/utils/helpers';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/utils/helpers';

interface ConclusionCardProps {
  conclusion: AnalysisConclusion;
  isSelected?: boolean;
  index?: number;
}

const SourceIcon: Record<SourceType, React.FC<{ className?: string }>> = {
  shift_record: FileText,
  work_log: ClipboardList,
  maintenance: Wrench,
  maintenance_order: Wrench,
};

export const ConclusionCard: React.FC<ConclusionCardProps> = ({
  conclusion,
  isSelected = false,
  index,
}) => {
  const { navigateToSource, selectedConclusionId, setSelectedConclusionId } = useUIStore();
  const levelColor = getLevelColor(conclusion.thresholdLevel);

  const handleClick = () => {
    setSelectedConclusionId(conclusion.id === selectedConclusionId ? null : conclusion.id);
    navigateToSource({
      sourceType: conclusion.sourceType,
      sourceId: conclusion.sourceId,
      sourceVersion: conclusion.sourceVersion || 1,
      sourceLine: conclusion.sourceLine || 0,
    });
  };

  const StatusIcon = conclusion.thresholdLevel === 'normal'
    ? CheckCircle2
    : conclusion.thresholdLevel === 'warning'
    ? AlertTriangle
    : XCircle;

  const Icon = SourceIcon[conclusion.sourceType];

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all duration-200 cursor-pointer group',
        isSelected || selectedConclusionId === conclusion.id
          ? 'border-tech-blue bg-tech-blue/10 shadow-glow-blue'
          : 'border-industrial-border bg-industrial-bg-light hover:border-tech-blue/50 hover:bg-industrial-bg-lighter'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {index !== undefined && (
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: levelColor, color: '#1a1d23' }}
          >
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${levelColor}20`, color: levelColor }}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{getLevelLabel(conclusion.thresholdLevel)}</span>
            </div>

            <div className="flex items-center gap-1 text-xs text-industrial-text-muted">
              <Clock className="w-3 h-3" />
              <span>{formatDateTime(conclusion.timestamp)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4" style={{ color: levelColor }} />
              <span className="font-mono font-bold text-lg" style={{ color: levelColor }}>
                {conclusion.pressure.toFixed(2)} MPa
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-industrial-text-muted">
              <Icon className="w-3.5 h-3.5" />
              <span>{SOURCE_TYPE_LABELS[conclusion.sourceType]}</span>
            </div>
          </div>

          <p className="text-sm text-industrial-text mb-2 line-clamp-2">
            {conclusion.description}
          </p>

          <div className="flex items-center justify-between text-xs text-industrial-text-muted">
            <div className="flex items-center gap-3">
              <span>ID: {conclusion.sourceId.slice(-8)}</span>
              {conclusion.sourceVersion !== undefined && (
                <span>版本: v{conclusion.sourceVersion}</span>
              )}
              {conclusion.sourceLine !== undefined && (
                <span>行号: 第{conclusion.sourceLine}行</span>
              )}
            </div>

            <ExternalLink
              className={cn(
                'w-4 h-4 transition-colors',
                'text-industrial-text-dim group-hover:text-tech-blue'
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
