import { Play, CheckSquare, X } from 'lucide-react';

interface BatchToolbarProps {
  selectedCount: number;
  totalCount: number;
  batchProcessing: boolean;
  batchProgress: number;
  batchTotal: number;
  onBatchAnalyze: () => void;
  onBatchConfirm: () => void;
  onClearSelection: () => void;
}

export default function BatchToolbar({
  selectedCount,
  totalCount,
  batchProcessing,
  batchProgress,
  batchTotal,
  onBatchAnalyze,
  onBatchConfirm,
  onClearSelection,
}: BatchToolbarProps) {
  if (selectedCount === 0 && !batchProcessing) return null;

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {batchProcessing ? (
            <div className="flex items-center gap-3">
              <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(batchProgress / batchTotal) * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-400">
                处理中: {batchProgress}/{batchTotal}
              </span>
            </div>
          ) : (
            <>
              <span className="text-gray-300">
                已选择 <span className="text-blue-400 font-medium">{selectedCount}</span> / {totalCount} 条
              </span>
              <div className="h-5 w-px bg-gray-700" />
              <button
                onClick={onBatchAnalyze}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                批量分析
              </button>
              <button
                onClick={onBatchConfirm}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                批量确认
              </button>
              <button
                onClick={onClearSelection}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                取消选择
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
