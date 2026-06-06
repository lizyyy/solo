import { ChangeLog } from '@/types';
import { groupChangesByTime, getFieldDisplayName, formatValue } from '@/utils/changeTracker';
import { DiffViewer } from './DiffViewer';
import { User, Clock, Info } from 'lucide-react';

interface ChangeTimelineProps {
  logs: ChangeLog[];
  compact?: boolean;
}

export function ChangeTimeline({ logs, compact = false }: ChangeTimelineProps) {
  const groups = groupChangesByTime(logs);

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无变更记录</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="relative pl-10">
            <div className="absolute left-2 top-1 w-5 h-5 rounded-full border-2 border-white bg-amber-500 shadow z-10" />

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-800">
                    {group.operator === 'system' ? '系统自动检测' : group.operator}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(group.timestamp).toLocaleString('zh-CN')}
                </div>
              </div>

              {group.changes[0]?.changeReason && (
                <div className="mb-3 px-3 py-2 bg-amber-50 rounded border border-amber-100">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">原因：</span>
                    {group.changes[0].changeReason}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {group.changes.map((log, logIdx) => (
                  compact ? (
                    <DiffViewer
                      key={logIdx}
                      fieldName={log.fieldName}
                      oldValue={log.oldValue}
                      newValue={log.newValue}
                      compact
                    />
                  ) : (
                    <DiffViewer
                      key={logIdx}
                      fieldName={log.fieldName}
                      oldValue={log.oldValue}
                      newValue={log.newValue}
                    />
                  )
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
