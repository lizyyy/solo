import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { compareVersions, detectCriticalChanges, generateChangeSummary } from '@/utils/diff';
import type { ScoreSheetVersion } from '@/types';
import { formatTimestamp } from '@/utils/storage';

interface DiffViewerProps {
  oldVersion: ScoreSheetVersion;
  newVersion: ScoreSheetVersion;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldVersion, newVersion }) => {
  const diffs = useMemo(() => compareVersions(oldVersion.content, newVersion.content), [oldVersion.content, newVersion.content]);
  const criticalChanges = useMemo(() => detectCriticalChanges(diffs), [diffs]);
  const summary = useMemo(() => generateChangeSummary(diffs), [diffs]);

  const oldLines = oldVersion.content.split('\n');
  const newLines = newVersion.content.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  const getLineChangeType = (lineIndex: number): 'added' | 'removed' | 'modified' | 'unchanged' => {
    const diff = diffs.find((d) => d.line === lineIndex + 1);
    return diff?.type || 'unchanged';
  };

  const _getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return 'bg-lab-conclusion/20 border-lab-conclusion text-lab-conclusion';
      case 'medium':
        return 'bg-lab-anomaly/20 border-lab-anomaly text-lab-anomaly';
      default:
        return 'bg-lab-supplement/20 border-lab-supplement text-lab-supplement';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 border-2 border-lab-border bg-lab-card">
        <div>
          <span className="text-xs text-lab-text-muted font-mono">变更摘要: </span>
          <span className="text-sm text-lab-text font-mono">{summary}</span>
        </div>
        {criticalChanges.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-lab-conclusion/10 border border-lab-conclusion">
            <AlertTriangle size={14} className="text-lab-conclusion" />
            <span className="text-xs text-lab-conclusion font-mono">{criticalChanges.length} 处关键变更</span>
          </div>
        )}
      </div>

      {criticalChanges.length > 0 && (
        <div className="border-2 border-lab-conclusion/50 bg-lab-card p-4">
          <h4 className="text-sm font-mono text-lab-conclusion mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            关键变更提醒
          </h4>
          <div className="space-y-2">
            {criticalChanges.map((change, index) => (
              <div
                key={index}
                className={`p-2 border-l-4 ${_getSeverityColor(change.severity)}`}
              >
                <div className="text-xs font-mono">
                  [{change.location}] {change.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-2 border-lab-border bg-lab-card overflow-hidden">
        <div className="grid grid-cols-2 border-b-2 border-lab-border">
          <div className="p-2 bg-lab-border/30 border-r border-lab-border">
            <div className="text-xs font-mono text-lab-text-muted">旧版本 v{oldVersion.version}</div>
            <div className="text-xs text-lab-text-muted">{formatTimestamp(oldVersion.uploadedAt)}</div>
            <div className="text-xs text-lab-text-muted">上传人: {oldVersion.uploader}</div>
          </div>
          <div className="p-2 bg-lab-accent/10">
            <div className="text-xs font-mono text-lab-accent">新版本 v{newVersion.version}</div>
            <div className="text-xs text-lab-text-muted">{formatTimestamp(newVersion.uploadedAt)}</div>
            <div className="text-xs text-lab-text-muted">上传人: {newVersion.uploader}</div>
          </div>
        </div>

        <div className="max-h-96 overflow-auto">
          {Array.from({ length: maxLines }, (_, i) => {
            const changeType = getLineChangeType(i);
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';

            const getBgColor = (type: string, isOld: boolean): string => {
              if (type === 'unchanged') return '';
              if (type === 'added') return isOld ? '' : 'bg-lab-accent/20';
              if (type === 'removed') return isOld ? 'bg-lab-conclusion/20' : '';
              return isOld ? 'bg-lab-conclusion/10' : 'bg-lab-accent/10';
            };

            return (
              <div key={i} className="grid grid-cols-2 font-mono text-xs">
                <div
                  className={`px-2 py-1 border-r border-lab-border ${getBgColor(changeType, true)} ${
                    changeType === 'removed' ? 'line-through opacity-60' : ''
                  }`}
                >
                  <span className="text-lab-text-muted mr-2 w-6 inline-block text-right">{i + 1}</span>
                  <span className={changeType === 'removed' ? 'text-lab-conclusion' : 'text-lab-text'}>
                    {oldLine || ' '}
                  </span>
                </div>
                <div className={`px-2 py-1 ${getBgColor(changeType, false)}`}>
                  <span className="text-lab-text-muted mr-2 w-6 inline-block text-right">{i + 1}</span>
                  <span className={changeType === 'added' ? 'text-lab-accent' : 'text-lab-text'}>
                    {newLine || ' '}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
