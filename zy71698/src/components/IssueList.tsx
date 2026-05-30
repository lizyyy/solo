import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, CheckCircle, MapPin, Lightbulb, Clock } from 'lucide-react';
import type { Issue } from '@/types';
import { getIssueSeverityColor, getIssueSeverityBg } from '@/services/checkService';
import { cn } from '@/lib/utils';
import { formatTimecodeFromSeconds } from '@/utils/timecode';

interface IssueListProps {
  issues: Issue[];
  onResolve?: (issueId: string) => void;
  onTimecodeClick?: (timecode: number) => void;
}

export const IssueList: React.FC<IssueListProps> = ({ issues, onResolve, onTimecodeClick }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return (a.timecode || 0) - (b.timecode || 0);
  });

  const errorCount = issues.filter(i => i.severity === 'error' && !i.resolved).length;
  const warningCount = issues.filter(i => i.severity === 'warning' && !i.resolved).length;
  const resolvedCount = issues.filter(i => i.resolved).length;

  if (issues.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-lg p-8 text-center">
        <CheckCircle className="mx-auto text-accent-success mb-3" size={40} />
        <h3 className="font-medium mb-1">未发现任何问题</h3>
        <p className="text-sm text-text-muted">所有材料的Cue点对齐情况良好</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg overflow-hidden">
      <div className="p-4 border-b border-bg-tertiary flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">问题列表</h3>
          <div className="flex items-center gap-3 text-sm">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-accent-error">
                <AlertCircle size={14} />
                {errorCount} 个错误
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-accent-warning">
                <AlertTriangle size={14} />
                {warningCount} 个警告
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="flex items-center gap-1 text-accent-success">
                <CheckCircle size={14} />
                {resolvedCount} 已解决
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="divide-y divide-bg-tertiary max-h-[500px] overflow-y-auto scrollbar-thin">
        {sortedIssues.map(issue => {
          const isExpanded = expandedIds.has(issue.id);
          const typeLabels: Record<string, string> = {
            timecode: '时间码',
            version: '版本',
            conflict: '冲突',
          };

          return (
            <div
              key={issue.id}
              className={cn(
                'transition-colors',
                issue.resolved ? 'opacity-60' : '',
                getIssueSeverityBg(issue.severity)
              )}
            >
              <div
                className="p-4 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                onClick={() => toggleExpand(issue.id)}
              >
                <div className="flex items-start gap-3">
                  <button
                    className="mt-1 text-text-muted hover:text-text-primary transition-colors"
                    onClick={e => {
                      e.stopPropagation();
                      toggleExpand(issue.id);
                    }}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div className="flex-shrink-0 mt-1">
                    {issue.severity === 'error' ? (
                      <AlertCircle className="text-accent-error" size={18} />
                    ) : (
                      <AlertTriangle className="text-accent-warning" size={18} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs px-2 py-0.5 rounded bg-bg-tertiary', getIssueSeverityColor(issue.severity))}>
                        {typeLabels[issue.type]}
                      </span>
                      <span className="text-xs text-text-muted">{issue.detectionStep}</span>
                      {issue.resolved && (
                        <span className="text-xs px-2 py-0.5 rounded bg-accent-success/20 text-accent-success">
                          已解决
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{issue.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {issue.location}
                      </span>
                      {issue.timecode !== undefined && (
                        <button
                          className="flex items-center gap-1 hover:text-accent-success transition-colors timecode"
                          onClick={e => {
                            e.stopPropagation();
                            onTimecodeClick?.(issue.timecode!);
                          }}
                        >
                          <Clock size={12} />
                          {formatTimecodeFromSeconds(issue.timecode)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pl-14">
                  <div className="bg-bg-tertiary rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="text-accent-warning flex-shrink-0 mt-0.5" size={14} />
                      <div>
                        <p className="text-xs text-text-muted mb-0.5">建议操作</p>
                        <p className="text-sm">{issue.suggestion}</p>
                      </div>
                    </div>

                    {onResolve && !issue.resolved && (
                      <div className="flex justify-end pt-2 border-t border-bg-secondary">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onResolve(issue.id);
                          }}
                          className="text-xs text-accent-success hover:text-accent-success/80 transition-colors"
                        >
                          标记为已解决
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
