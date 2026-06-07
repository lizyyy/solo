import { History, Clock, User, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { history } = useStore();

  const getActionLabel = (action: string) => {
    const labels: Record<string, { label: string; className: string }> = {
      create: { label: '新建', className: 'bg-blue-100 text-blue-700' },
      update: { label: '更新', className: 'bg-purple-100 text-purple-700' },
      import: { label: '导入', className: 'bg-emerald-100 text-emerald-700' },
      confirm: { label: '确认', className: 'bg-emerald-100 text-emerald-700' },
      reject: { label: '驳回', className: 'bg-red-100 text-red-700' },
      review: { label: '复核', className: 'bg-amber-100 text-amber-700' },
    };
    return labels[action] || { label: action, className: 'bg-slate-100 text-slate-700' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">历史记录</h2>
        <p className="text-sm text-slate-500 mt-1">所有操作留痕，可追溯数据变更历史</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm text-slate-500">共 {history.length} 条记录</p>
        </div>

        <div className="p-6">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

            <div className="space-y-6">
              {history.map((record) => {
                const actionConfig = getActionLabel(record.action);
                return (
                  <div key={record.id} className="relative flex gap-4">
                    <div className="relative z-10 w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-slate-400" />
                    </div>

                    <div className="flex-1 bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', actionConfig.className)}>
                            {actionConfig.label}
                          </span>
                          <span className="text-sm font-medium text-slate-800">{record.pointName}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(record.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 mb-3">{record.remark}</p>

                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-500">操作人：{record.operator}</span>
                      </div>

                      {Object.keys(record.beforeData).length > 0 && Object.keys(record.afterData).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex-1">
                              <p className="text-slate-500 mb-1">变更前</p>
                              <pre className="bg-slate-100 p-2 rounded text-slate-600 overflow-x-auto">
                                {JSON.stringify(record.beforeData, null, 2)}
                              </pre>
                            </div>
                            <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-slate-500 mb-1">变更后</p>
                              <pre className="bg-emerald-50 p-2 rounded text-emerald-700 overflow-x-auto">
                                {JSON.stringify(record.afterData, null, 2)}
                              </pre>
                            </div>
                          </div>
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
