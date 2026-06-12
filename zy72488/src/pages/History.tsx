import { useState } from 'react';
import {
  History,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

const actionLabels: Record<string, { label: string; className: string }> = {
  create: { label: '新建', className: 'bg-blue-100 text-blue-700' },
  update: { label: '更新', className: 'bg-purple-100 text-purple-700' },
  import: { label: '导入', className: 'bg-emerald-100 text-emerald-700' },
  confirm: { label: '确认', className: 'bg-emerald-100 text-emerald-700' },
  reject: { label: '驳回', className: 'bg-red-100 text-red-700' },
  review: { label: '复核', className: 'bg-amber-100 text-amber-700' },
  supplement: { label: '补录', className: 'bg-indigo-100 text-indigo-700' },
};

export default function HistoryPage() {
  const { history } = useStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getActionConfig = (action: string) => {
    return actionLabels[action] || { label: action, className: 'bg-slate-100 text-slate-700' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">历史记录</h2>
        <p className="text-sm text-slate-500 mt-1">
          所有操作留痕，可追溯数据变更历史，包含改前改后内容和修改原因
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">共 {history.length} 条记录</p>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <FileText size={12} />
            点击展开查看详情
          </div>
        </div>

        <div className="p-6">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

            <div className="space-y-5">
              {history.map((record) => {
                const actionConfig = getActionConfig(record.action);
                const isExpanded = expandedId === record.id;
                const hasFieldChanges = record.fieldChanges && record.fieldChanges.length > 0;

                return (
                  <div key={record.id} className="relative flex gap-4">
                    <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-slate-400" />
                    </div>

                    <div className="flex-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className={cn(
                          'w-full text-left bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors',
                          isExpanded && 'bg-slate-100'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                actionConfig.className
                              )}
                            >
                              {actionConfig.label}
                            </span>
                            <span className="text-sm font-medium text-slate-800">
                              {record.pointName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              {new Date(record.createdAt).toLocaleString('zh-CN')}
                            </span>
                            {isExpanded ? (
                              <ChevronUp size={14} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-400" />
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-slate-600">{record.remark}</p>

                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <User size={12} />
                            <span>操作人：{record.operator}</span>
                          </div>
                          {record.changeReason && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <MessageSquare size={12} />
                              <span>原因：{record.changeReason}</span>
                            </div>
                          )}
                        </div>
                      </button>

                      {isExpanded && hasFieldChanges && (
                        <div className="mt-3 ml-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                            <p className="text-xs font-medium text-slate-500">字段变更详情</p>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {record.fieldChanges.map((change, idx) => (
                              <div
                                key={idx}
                                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50"
                              >
                                <span className="text-sm font-medium text-slate-700 w-28 flex-shrink-0">
                                  {change.fieldLabel}
                                </span>
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded flex-1 truncate">
                                    {change.beforeValue || '（空）'}
                                  </span>
                                  <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded flex-1 truncate">
                                    {change.afterValue || '（空）'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isExpanded && !hasFieldChanges && (
                        <div className="mt-3 ml-4 p-3 bg-white border border-slate-200 rounded-lg">
                          <p className="text-xs text-slate-400">无字段变更详情</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {history.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-16 text-center">
          <History size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">暂无历史记录</p>
        </div>
      )}
    </div>
  );
}
