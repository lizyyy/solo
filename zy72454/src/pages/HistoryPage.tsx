import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, RotateCcw, ChevronRight, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const fieldLabels: Record<string, string> = {
  redline_note: '红线图备注',
  status: '状态',
  has_construction_detour: '施工改道标记',
};

export const HistoryPage: React.FC = () => {
  const { historyRecords, fetchHistory, rollbackHistory, loading } = useAppStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRollback = async (id: string) => {
    if (confirm('确定要回滚到此版本吗？此操作会记录新的变更历史。')) {
      await rollbackHistory(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            全量变更历史
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            所有断点的变更记录，支持回滚到历史版本（会保留回滚操作本身的记录）
          </p>
        </div>
        <div className="divide-y divide-stone-100 max-h-[600px] overflow-y-auto">
          {historyRecords.length === 0 ? (
            <div className="px-6 py-12 text-center text-stone-400 text-sm">暂无历史记录</div>
          ) : (
            historyRecords.map((h) => (
              <div key={h.id} className="px-6 py-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-stone-800 text-sm">
                        {fieldLabels[h.fieldName] || h.fieldName}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(h.changedAt).toLocaleString('zh-CN')}
                      </span>
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                        {h.changedBy}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Link
                        to={`/breakpoints/${h.breakpointId}`}
                        className="text-emerald-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        查看断点
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    {(h.oldValue !== null || h.newValue !== null) && (
                      <div className="mt-3 bg-stone-50 rounded-lg p-3 text-sm space-y-2 max-w-xl">
                        {h.oldValue !== null && (
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 font-mono text-xs bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">改前</span>
                            <span className="text-stone-600 break-words">{String(h.oldValue)}</span>
                          </div>
                        )}
                        {h.newValue !== null && (
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 font-mono text-xs bg-green-50 px-1.5 py-0.5 rounded flex-shrink-0">改后</span>
                            <span className="text-stone-800 break-words">{String(h.newValue)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRollback(h.id)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-stone-500 hover:text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    回滚
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
