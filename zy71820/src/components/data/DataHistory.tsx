import { useEffect, useState } from 'react';
import { History, User, Calendar, ArrowRight, FileJson } from 'lucide-react';
import { getOperationHistory } from '@/services/DataService';
import { formatDate } from '@/utils/helpers';
import type { OperationHistory } from '@/types/data';

interface DataHistoryProps {
  history: OperationHistory[];
  isLoading: boolean;
  operationTypeLabels: Record<string, { label: string; color: string }>;
  targetTypeLabels: Record<string, string>;
}

export function DataHistory({
  history: propHistory,
  isLoading: propLoading,
  operationTypeLabels,
  targetTypeLabels,
}: DataHistoryProps) {
  const [localHistory, setLocalHistory] = useState<OperationHistory[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [useLocalData, setUseLocalData] = useState(false);

  useEffect(() => {
    if (propHistory.length === 0 && propLoading === false) {
      setUseLocalData(true);
      loadHistory();
    }
  }, [propHistory, propLoading]);

  const loadHistory = async () => {
    setLocalLoading(true);
    try {
      const data = await getOperationHistory();
      setLocalHistory(data);
    } catch (error) {
      console.error('Load history failed:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const history = useLocalData ? localHistory : propHistory;
  const isLoading = useLocalData ? localLoading : propLoading;

  const displayData = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-neon-orange">
          操作历史 ({history.length})
        </h3>
        {useLocalData && (
          <button
            onClick={loadHistory}
            className="text-sm text-gray-400 hover:text-neon-orange transition-colors"
          >
            刷新
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-neon-orange border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-body text-gray-400">加载中...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <History size={48} className="mx-auto text-gray-500 mb-4 opacity-50" />
          <p className="font-body text-gray-400">暂无操作历史</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-night-card rounded-xl p-4 border border-night-card hover:border-neon-orange/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-lg border ${operationTypeLabels[item.operationType]?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
                >
                  {item.operationType === 'import' && <FileJson size={18} />}
                  {item.operationType === 'review' && <User size={18} />}
                  {item.operationType === 'correct' && <ArrowRight size={18} />}
                  {item.operationType === 'export' && <FileJson size={18} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${operationTypeLabels[item.operationType]?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
                    >
                      {operationTypeLabels[item.operationType]?.label || item.operationType}
                    </span>
                    <span className="font-body text-white font-medium">
                      {item.reason}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <User size={14} />
                      {item.operator}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(item.createdAt)}
                    </div>
                    <div>
                      目标: {targetTypeLabels[item.targetType] || item.targetType} / {item.targetId.slice(0, 8)}...
                    </div>
                  </div>

                  {item.beforeData != null && item.afterData != null && (
                    <div className="mt-3 pt-3 border-t border-night-surface">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-500">操作前：</span>
                          <pre className="text-gray-400 mt-1 overflow-x-auto max-h-20">
                            {displayData(item.beforeData).slice(0, 200)}
                            {displayData(item.beforeData).length > 200 && '...'}
                          </pre>
                        </div>
                        <div>
                          <span className="text-gray-500">操作后：</span>
                          <pre className="text-gray-400 mt-1 overflow-x-auto max-h-20">
                            {displayData(item.afterData).slice(0, 200)}
                            {displayData(item.afterData).length > 200 && '...'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
