import { useState } from 'react';
import { ChangeLog } from '@/types';
import { groupChangesByTime, getFieldDisplayName, formatValue } from '@/utils/changeTracker';
import { DiffViewer } from './DiffViewer';
import { useStore } from '@/store/useStore';
import {
  User,
  Clock,
  Info,
  RotateCcw,
  Undo2,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';

interface ChangeTimelineProps {
  logs: ChangeLog[];
  compact?: boolean;
  recordId?: string;
}

export function ChangeTimeline({ logs, compact = false, recordId }: ChangeTimelineProps) {
  const groups = groupChangesByTime(logs);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [rollbackStatus, setRollbackStatus] = useState<{ groupIdx: number; status: 'success' | 'error' } | null>(null);

  const rollbackFieldChange = useStore(state => state.rollbackFieldChange);
  const rollbackRecordToChange = useStore(state => state.rollbackRecordToChange);
  const currentUser = useStore(state => state.currentUser);

  const toggleGroup = (idx: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleRollbackGroup = (groupIdx: number) => {
    if (!recordId) return;
    const group = groups[groupIdx];
    const lastLogId = group.changes[group.changes.length - 1].id;

    const success = rollbackRecordToChange(
      recordId,
      lastLogId,
      currentUser.name,
      `人工回滚到 ${new Date(group.timestamp).toLocaleString('zh-CN')} 的状态`
    );

    setRollbackStatus({ groupIdx, status: success ? 'success' : 'error' });
    setTimeout(() => setRollbackStatus(null), 2500);
  };

  const handleRollbackField = (groupIdx: number, logIdx: number) => {
    if (!recordId) return;
    const log = groups[groupIdx].changes[logIdx];
    const success = rollbackFieldChange(
      recordId,
      log.id,
      currentUser.name,
      `人工单字段回滚：${getFieldDisplayName(log.fieldName)}`
    );
    setRollbackStatus({ groupIdx, status: success ? 'success' : 'error' });
    setTimeout(() => setRollbackStatus(null), 2500);
  };

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
        {groups.map((group, groupIdx) => {
          const isExpanded = expandedGroups.has(groupIdx);
          const isLatest = groupIdx === 0;
          const isRollbackOp = group.changes.some(c => c.changeReason.includes('回滚'));

          return (
            <div key={groupIdx} className="relative pl-10">
              <div className={`absolute left-2 top-1 w-5 h-5 rounded-full border-2 border-white shadow z-10 flex items-center justify-center ${
                isRollbackOp ? 'bg-purple-500' : isLatest ? 'bg-amber-500' : 'bg-gray-400'
              }`}>
                {isRollbackOp ? (
                  <RotateCcw className="w-2.5 h-2.5 text-white" />
                ) : null}
              </div>

              <div className={`rounded-lg overflow-hidden border transition-colors ${
                rollbackStatus?.groupIdx === groupIdx
                  ? rollbackStatus.status === 'success'
                    ? 'border-green-300 bg-green-50/30'
                    : 'border-red-300 bg-red-50/30'
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100/50"
                  onClick={() => toggleGroup(groupIdx)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-800">
                        {group.operator === 'system' ? '系统自动检测' : group.operator}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                      {group.changes.length} 处变更
                    </span>
                    {isRollbackOp && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        <RotateCcw className="w-3 h-3" />
                        回滚操作
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(group.timestamp).toLocaleString('zh-CN')}
                    </div>
                    {recordId && !isLatest && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRollbackGroup(groupIdx); }}
                        className="px-2 py-1 text-xs bg-white border border-gray-200 rounded text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors flex items-center gap-1"
                        title="回滚到此节点（恢复此时的所有字段值）"
                      >
                        <Undo2 className="w-3 h-3" />
                        回滚到此处
                      </button>
                    )}
                    {rollbackStatus?.groupIdx === groupIdx && rollbackStatus.status === 'success' && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> 已回滚
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {group.changes[0]?.changeReason && (
                  <div className="px-3 pb-3">
                    <div className="px-3 py-2 bg-amber-50 rounded border border-amber-100">
                      <p className="text-sm text-amber-800">
                        <span className="font-medium">原因：</span>
                        {group.changes[0].changeReason}
                      </p>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {group.changes.map((log, logIdx) => (
                      <div key={logIdx} className="relative">
                        <DiffViewer
                          fieldName={log.fieldName}
                          oldValue={log.oldValue}
                          newValue={log.newValue}
                          compact
                        />
                        {recordId && log.oldValue !== '' && !isRollbackOp && (
                          <div className="absolute right-2 top-2">
                            <button
                              onClick={() => handleRollbackField(groupIdx, logIdx)}
                              className="p-1 text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title={`回滚此字段：${getFieldDisplayName(log.fieldName)}`}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
