import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Conflict } from '@/types';
import { getConflictTypeLabel } from '@/utils/helpers';

interface ConflictBadgeProps {
  conflict: Conflict;
  onResolve?: () => void;
  showResolve?: boolean;
  compact?: boolean;
}

export function ConflictBadge({ conflict, onResolve, showResolve = true, compact = false }: ConflictBadgeProps) {
  const severityClass = conflict.severity === 'error'
    ? 'border-neon-red text-neon-red bg-neon-red bg-opacity-10'
    : 'border-neon-orange text-neon-orange bg-neon-orange bg-opacity-10';

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono border ${severityClass} ${!conflict.resolved ? 'animate-pulse' : 'opacity-60'}`}
        title={conflict.description}
      >
        {conflict.resolved ? (
          <CheckCircle className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span className="uppercase tracking-wider">{getConflictTypeLabel(conflict.type)}</span>
      </span>
    );
  }

  return (
    <div
      className={`p-3 border-2 ${severityClass} ${!conflict.resolved ? 'animate-pulse' : 'opacity-60'}`}
    >
      <div className="flex items-start gap-2">
        {conflict.resolved ? (
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              {getConflictTypeLabel(conflict.type)}
            </span>
            <span className="text-xs opacity-60">
              {conflict.severity === 'error' ? '错误' : '警告'}
            </span>
            {conflict.resolved && (
              <span className="text-xs text-neon-green">已解决</span>
            )}
          </div>
          <p className="text-sm mt-1 font-mono">{conflict.description}</p>
          {!conflict.resolved && showResolve && onResolve && (
            <button
              onClick={onResolve}
              className="mt-2 text-xs font-mono underline hover:text-white transition-colors"
            >
              标记为已解决
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
