import { cn } from '@/lib/utils';
import type { DataConflict } from '../types';

interface ConflictPanelProps {
  conflicts: DataConflict[];
  onResolve: (id: string, decision: string) => void;
}

function ConflictCard({
  conflict,
  onResolve,
  index,
}: {
  conflict: DataConflict;
  onResolve: (id: string, decision: string) => void;
  index: number;
}) {
  const isResolved = !!conflict.userDecision;

  return (
    <div
      className={cn(
        'eng-card overflow-hidden',
        'opacity-0 animate-fade-in-up'
      )}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="p-4 border-b border-ink-200 bg-ink-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <span className="font-bold text-ink-800">
              字段冲突: {conflict.field}
            </span>
          </div>
          {isResolved ? (
            <span className="eng-badge-safe">
              ✓ 已解决
            </span>
          ) : (
            <span className="eng-badge-danger animate-pulse">
              待处理
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-stretch gap-4">
          <div className="flex-1 bg-safe-50 border-2 border-safe-300 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📷</span>
              <span className="text-sm font-bold text-safe-700">
                现场照片说法
              </span>
            </div>
            <div className="raw-note text-ink-700 mb-3">
              {conflict.photoEvidence}
            </div>
            {conflict.photoValue !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-500">提取数值:</span>
                <span className="font-mono text-lg font-bold text-safe-700">
                  {conflict.photoValue}
                  {conflict.photoUnit && ` ${conflict.photoUnit}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center animate-vs-rotate">
              <span className="text-xl font-bold text-danger-600">VS</span>
            </div>
          </div>

          <div className="flex-1 bg-warning-50 border-2 border-warning-300 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📊</span>
              <span className="text-sm font-bold text-warning-700">
                导入数据
              </span>
            </div>
            <div className="mb-3">
              <div className="font-mono text-lg font-bold text-warning-700 mb-2">
                {conflict.importedValue}
              </div>
              <div className="text-xs text-ink-500">
                来源: {conflict.importedSource}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {isResolved ? (
            <div className="bg-safe-50 border border-safe-300 rounded p-3">
              <div className="flex items-center gap-2">
                <span className="text-safe-600">✓</span>
                <span className="text-sm text-safe-700">
                  用户决策: <strong>{conflict.userDecision}</strong>
                </span>
                {conflict.decidedAt && (
                  <span className="text-xs text-ink-400 ml-auto">
                    {new Date(conflict.decidedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-ink-600 mb-3 flex items-center gap-1">
                <span>💡</span>
                <span>建议选择以下处理方式:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {conflict.suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => onResolve(conflict.id, action)}
                    className={cn(
                      'eng-btn eng-btn-sm text-sm',
                      idx === 0 ? 'eng-btn-primary' : ''
                    )}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConflictPanel({ conflicts, onResolve }: ConflictPanelProps) {
  const unresolvedCount = conflicts.filter((c) => !c.userDecision).length;
  const resolvedCount = conflicts.filter((c) => !!c.userDecision).length;

  if (conflicts.length === 0) {
    return (
      <div className="eng-card p-8">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-safe-100 flex items-center justify-center mb-4">
            <span className="text-3xl">🤝</span>
          </div>
          <h3 className="text-lg font-bold text-ink-800 mb-2">
            数据一致，没有冲突
          </h3>
          <p className="text-sm text-ink-500">
            现场记录和导入数据完美匹配，可以放心继续
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="eng-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="eng-section-title mb-0 border-b-0 pb-0">
              <span>⚔️</span>
              数据冲突
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {unresolvedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-danger-100 rounded">
                <span className="status-dot-danger"></span>
                <span className="text-sm font-bold text-danger-700">
                  {unresolvedCount} 个待处理
                </span>
              </div>
            )}
            {resolvedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-safe-100 rounded">
                <span className="status-dot-safe"></span>
                <span className="text-sm font-bold text-safe-700">
                  {resolvedCount} 个已解决
                </span>
              </div>
            )}
            <div className="text-sm text-ink-500">
              共 {conflicts.length} 个冲突
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {conflicts.map((conflict, index) => (
          <ConflictCard
            key={conflict.id}
            conflict={conflict}
            onResolve={onResolve}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
