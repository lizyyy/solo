import React from 'react';
import { ChevronRight, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBadge } from '@/components/reports/ErrorBadge';
import type { ExperimentRecord } from '@/types';
import { RESULT_LABELS } from '@/types';

interface RecordListProps {
  records: ExperimentRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const RecordList: React.FC<RecordListProps> = ({
  records,
  selectedId,
  onSelect,
  onDelete,
}) => {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText size={48} className="text-gray-700 mb-4" />
        <p className="text-gray-500 font-mono text-sm">暂无实验记录</p>
        <p className="text-gray-600 font-mono text-xs mt-1">
          完成一次模拟实验后，记录将自动保存在这里
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((record, index) => (
        <div
          key={record.id}
          className={cn(
            'group relative p-4 rounded-lg border transition-all duration-200 cursor-pointer',
            selectedId === record.id
              ? 'bg-gray-800/80 border-green-500/50'
              : 'bg-gray-900/50 border-gray-800 hover:bg-gray-800/50 hover:border-gray-700'
          )}
          onClick={() => onSelect(record.id)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-500 font-mono">#{records.length - index}</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono font-bold',
                    record.conclusion.result === 'escape' && 'bg-green-500/20 text-green-400',
                    record.conclusion.result === 'collide' && 'bg-red-500/20 text-red-400',
                    record.conclusion.result === 'orbit' && 'bg-blue-500/20 text-blue-400',
                    record.conclusion.result === 'chaos' && 'bg-purple-500/20 text-purple-400',
                    record.conclusion.result === 'timeout' && 'bg-yellow-500/20 text-yellow-400'
                  )}
                >
                  {RESULT_LABELS[record.conclusion.result]}
                </span>
                <span className="text-[10px] text-gray-600 font-mono">
                  {formatDate(record.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono mb-2">
                <div>
                  <span className="text-gray-600">角度: </span>
                  <span className="text-gray-400">{record.raw.launchAngle.toFixed(0)}°</span>
                </div>
                <div>
                  <span className="text-gray-600">速度: </span>
                  <span className="text-gray-400">{record.raw.launchSpeed.toFixed(0)}</span>
                </div>
                <div>
                  <span className="text-gray-600">时长: </span>
                  <span className="text-gray-400">{record.conclusion.duration.toFixed(2)}s</span>
                </div>
              </div>

              {record.conclusion.errorMarks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {record.conclusion.errorMarks.slice(0, 3).map((error) => (
                    <ErrorBadge key={error.id} type={error.type} showLabel={false} size="sm" />
                  ))}
                  {record.conclusion.errorMarks.length > 3 && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      +{record.conclusion.errorMarks.length - 3}
                    </span>
                  )}
                </div>
              )}

              {record.noteVersions.length > 0 && (
                <div className="mt-2 text-[10px] text-purple-400 font-mono">
                  📝 {record.noteVersions.length} 条备注
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('确定要删除这条记录吗？')) {
                    onDelete(record.id);
                  }
                }}
                className={cn(
                  'p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100',
                  'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                )}
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight
                size={16}
                className={cn(
                  'transition-colors',
                  selectedId === record.id ? 'text-green-400' : 'text-gray-600'
                )}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
