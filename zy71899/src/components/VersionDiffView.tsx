import React from 'react';
import { Plus, Minus, AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { VersionDiff } from '@/types';
import { cn } from '@/utils/helpers';

interface VersionDiffViewProps {
  diffs: VersionDiff[];
  showLineNumbers?: boolean;
  className?: string;
  workLogId?: string;
  oldVersion?: number;
  newVersion?: number;
  onClose?: () => void;
}

export const VersionDiffView: React.FC<VersionDiffViewProps> = ({
  diffs,
  showLineNumbers = true,
  className,
  workLogId,
  oldVersion,
  newVersion,
  onClose,
}) => {
  if (diffs.length === 0) {
    return (
      <div className="p-8 text-center text-industrial-text-muted">
        <p>未检测到版本差异</p>
      </div>
    );
  }

  const getIcon = (type: VersionDiff['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="w-4 h-4 text-signal-green" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-danger-red" />;
      case 'modified':
        return <ArrowRight className="w-4 h-4 text-alert-orange" />;
    }
  };

  const getDiffClass = (type: VersionDiff['type']) => {
    switch (type) {
      case 'added':
        return 'diff-added';
      case 'removed':
        return 'diff-removed';
      case 'modified':
        return 'diff-modified';
    }
  };

  const significantDiffs = diffs.filter((d) => d.affectsConclusionIds.length > 0);
  const otherDiffs = diffs.filter((d) => d.affectsConclusionIds.length === 0);

  return (
    <div className={cn('space-y-4', className)}>
      {significantDiffs.length > 0 && (
        <div className="p-3 bg-alert-orange/10 border border-alert-orange/30 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-alert-orange" />
            <span className="text-sm font-medium text-alert-orange">
              以下变更影响已有分析结论，请工程师确认
            </span>
          </div>
          <div className="space-y-1">
            {significantDiffs.map((diff, idx) => (
              <DiffRow
                key={`sig-${idx}`}
                diff={diff}
                showLineNumbers={showLineNumbers}
                getIcon={getIcon}
                getDiffClass={getDiffClass}
              />
            ))}
          </div>
        </div>
      )}

      {otherDiffs.length > 0 && (
        <div>
          <p className="text-sm text-industrial-text-muted mb-2">
            其他变更 ({otherDiffs.length} 处)
          </p>
          <div className="space-y-1">
            {otherDiffs.map((diff, idx) => (
              <DiffRow
                key={`other-${idx}`}
                diff={diff}
                showLineNumbers={showLineNumbers}
                getIcon={getIcon}
                getDiffClass={getDiffClass}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface DiffRowProps {
  diff: VersionDiff;
  showLineNumbers: boolean;
  getIcon: (type: VersionDiff['type']) => React.ReactNode;
  getDiffClass: (type: VersionDiff['type']) => string;
}

const DiffRow: React.FC<DiffRowProps> = ({
  diff,
  showLineNumbers,
  getIcon,
  getDiffClass,
}) => {
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded font-mono text-sm',
        getDiffClass(diff.type)
      )}
    >
      <span className="flex-shrink-0 mt-0.5">{getIcon(diff.type)}</span>

      {showLineNumbers && (
        <span className="flex-shrink-0 w-12 text-right text-industrial-text-dim text-xs">
          {diff.line}
        </span>
      )}

      <div className="flex-1 min-w-0">
        {diff.type === 'modified' ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-danger-red line-through">{diff.oldValue}</span>
              <ArrowRight className="w-3 h-3 text-industrial-text-dim flex-shrink-0" />
              <span className="text-signal-green">{diff.newValue}</span>
            </div>
            {diff.pressureChange !== undefined && (
              <div className="text-xs text-industrial-text-muted">
                压力变化: {diff.pressureChange > 0 ? '+' : ''}
                {diff.pressureChange.toFixed(2)} MPa
              </div>
            )}
          </div>
        ) : (
          <span
            className={cn(
              diff.type === 'added' ? 'text-signal-green' : 'text-danger-red'
            )}
          >
            {diff.type === 'added' ? diff.newValue : diff.oldValue}
          </span>
        )}

        {diff.affectsConclusionIds.length > 0 && (
          <div className="mt-1 text-xs text-alert-orange">
            影响结论: {diff.affectsConclusionIds.map((id) => id.slice(-6)).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};
