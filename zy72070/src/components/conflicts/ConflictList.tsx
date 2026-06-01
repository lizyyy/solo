import { useAppStore } from '@/store/useAppStore';
import { CONFLICT_TYPE_LABELS } from '@/types';
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function ConflictList() {
  const { conflicts, resolveConflict, project } = useAppStore((state) => ({
    conflicts: state.conflicts,
    resolveConflict: state.resolveConflict,
    project: state.project,
  }));

  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedConflicts(newExpanded);
  };

  const severityColors = {
    low: 'bg-accent-blue/20 text-accent-blue border-accent-blue/30',
    medium: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
    high: 'bg-accent-red/20 text-accent-red border-accent-red/30',
  };

  const severityLabels = {
    low: '低',
    medium: '中',
    high: '高',
  };

  const unresolvedCount = conflicts.filter(c => !c.resolved).length;

  return (
    <div className="bg-bg-secondary border-t border-border-subtle">
      <div className="p-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-yellow" />
          <h3 className="font-medium text-text-primary">冲突检测</h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-accent-yellow/20 text-accent-yellow">
            {unresolvedCount} 待处理
          </span>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {conflicts.length === 0 ? (
          <div className="p-6 text-center text-text-muted text-sm">
            暂无冲突检测结果
          </div>
        ) : (
          conflicts.map((conflict) => {
            const isExpanded = expandedConflicts.has(conflict.id);

            return (
              <div
                key={conflict.id}
                className={`border-b border-border-subtle ${conflict.resolved ? 'opacity-60' : ''}`}
              >
                <div
                  className="p-3 cursor-pointer hover:bg-bg-tertiary/50"
                  onClick={() => toggleExpand(conflict.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary text-sm">
                          {CONFLICT_TYPE_LABELS[conflict.type]}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded border ${severityColors[conflict.severity]}`}>
                          {severityLabels[conflict.severity]}
                        </span>
                        {conflict.resolved && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-accent-green/20 text-accent-green">
                            已解决
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {conflict.suggestion}
                      </p>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pl-9">
                    <div className="p-3 bg-bg-tertiary rounded space-y-3">
                      <div>
                        <div className="text-xs font-medium text-text-secondary mb-2">双方证据</div>
                        <div className="space-y-2">
                          {conflict.evidence.map((ev, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className={`px-2 py-0.5 rounded ${
                                ev.source === 'device'
                                  ? 'bg-accent-blue/20 text-accent-blue'
                                  : 'bg-accent-green/20 text-accent-green'
                              }`}>
                                {ev.source === 'device' ? '现场数据' : 'CAD数据'}
                              </span>
                              <span className="text-text-muted">{ev.field}:</span>
                              <span className="font-mono text-text-primary">
                                {String(ev.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-text-secondary mb-2">建议动作</div>
                        <p className="text-xs text-text-primary">{conflict.suggestion}</p>
                      </div>

                      {!conflict.resolved && (
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              resolveConflict(conflict.id, project.operator);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-accent-green/20 text-accent-green hover:bg-accent-green/30 rounded text-xs transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            标记已解决
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
