import { OperationLog } from '@/types';
import { ActionBadge } from './StatusBadge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime } from '@/utils';

interface TimelineProps {
  logs: OperationLog[];
}

export default function Timeline({ logs }: TimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        暂无操作记录
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />
      <div className="space-y-6">
        {logs.map((log, index) => (
          <TimelineItem key={log.id} log={log} isLast={index === logs.length - 1} />
        ))}
      </div>
    </div>
  );
}

interface TimelineItemProps {
  log: OperationLog;
  isLast: boolean;
}

function TimelineItem({ log, isLast }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = log.beforeData || log.afterData;

  const actionColors: Record<string, string> = {
    import: '#06B6D4',
    review: '#8B5CF6',
    modify: '#F59E0B',
    export: '#10B981',
    permission_change: '#EC4899',
    create: '#6366F1',
  };

  return (
    <div className="relative pl-10">
      <div
        className="absolute left-0 w-8 h-8 rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center"
        style={{ borderColor: `${actionColors[log.action]}50` }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: actionColors[log.action] }}
        />
      </div>

      <div className={`bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden ${hasDiff ? 'cursor-pointer hover:border-slate-600' : ''}`}
           onClick={hasDiff ? () => setExpanded(!expanded) : undefined}>
        <div className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <ActionBadge action={log.action} />
              <span className="text-white text-sm font-medium">{log.operator}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{formatDateTime(log.createdAt)}</span>
              {hasDiff && (
                expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>
          <p className="mt-2 text-slate-300 text-sm">{log.reason}</p>
        </div>

        {expanded && hasDiff && (
          <div className="border-t border-slate-700 p-4 bg-slate-900/50">
            <div className="grid grid-cols-2 gap-4">
              {log.beforeData && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-400 px-2 py-0.5 rounded bg-red-500/10 text-red-400">修改前</span>
                  </div>
                  <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(log.beforeData, null, 2)}
                  </pre>
                </div>
              )}
              {log.afterData && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-400 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">修改后</span>
                  </div>
                  <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(log.afterData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
