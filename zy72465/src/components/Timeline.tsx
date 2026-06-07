import { Clock, User, RotateCcw } from 'lucide-react';
import type { HistoryEntry } from '@/types';
import { ROLE_LABELS } from '@/types';

interface TimelineProps {
  entries: HistoryEntry[];
  onRollback?: (historyId: string) => void;
  canRollback?: boolean;
}

const actionLabels: Record<string, string> = {
  create: '创建记录',
  update_status: '变更状态',
  update_name: '修改名称',
  add_sampling: '补看采样点',
  update_summary: '更新摘要',
  rollback: '回滚操作',
  confirm_name: '确认最终名称',
};

export default function Timeline({ entries, onRollback, canRollback = false }: TimelineProps) {
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-gray-200" />
      
      <div className="space-y-6">
        {sortedEntries.map((entry, index) => (
          <div key={entry.id} className="relative pl-12">
            <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center z-10 ${
              entry.action === 'rollback' 
                ? 'bg-orange-100 text-orange-600' 
                : entry.action === 'create'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600'
            }`}>
              {entry.action === 'rollback' ? (
                <RotateCcw className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">
                      {actionLabels[entry.action] || entry.action}
                    </span>
                    {entry.field && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        字段: {entry.field}
                      </span>
                    )}
                  </div>
                  
                  {entry.remark && (
                    <p className="mt-2 text-sm text-gray-600">{entry.remark}</p>
                  )}
                  
                  {(entry.oldValue !== undefined || entry.newValue !== undefined) && (
                    <div className="mt-3 space-y-1.5">
                      {entry.oldValue !== undefined && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-gray-400 shrink-0">修改前:</span>
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded line-through">
                            {typeof entry.oldValue === 'object' 
                              ? JSON.stringify(entry.oldValue) 
                              : String(entry.oldValue) || '(空)'}
                          </span>
                        </div>
                      )}
                      {entry.newValue !== undefined && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-gray-400 shrink-0">修改后:</span>
                          <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">
                            {typeof entry.newValue === 'object' 
                              ? JSON.stringify(entry.newValue) 
                              : String(entry.newValue) || '(空)'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {entry.operator}
                      <span className="text-gray-300">|</span>
                      {ROLE_LABELS[entry.operatorRole]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.timestamp).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
                
                {canRollback && entry.action !== 'rollback' && index === 0 && onRollback && (
                  <button
                    onClick={() => onRollback(entry.id)}
                    className="shrink-0 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    回滚
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
