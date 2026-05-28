import { useState } from 'react';
import { CompareTable } from '@/components/CompareTable';
import { usePrintStore } from '@/store/usePrintStore';
import { getMaterialById } from '@/data/materials';
import { CheckSquare, Square, Trash2, BarChart3, ArrowRight } from 'lucide-react';

export default function ParameterCompare() {
  const { batches, loadBatchById, currentBatch } = usePrintStore();
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId]
    );
  };

  const selectAll = () => {
    setSelectedBatchIds(batches.map((b) => b.id));
  };

  const clearSelection = () => {
    setSelectedBatchIds([]);
  };

  const selectedBatches = batches.filter((b) => selectedBatchIds.includes(b.id));

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      analyzed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      confirmed: 'bg-green-500/20 text-green-400 border-green-500/50',
    };
    return classes[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      analyzed: '已分析',
      confirmed: '已确认',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">参数对比</h2>
          <p className="text-sm text-gray-400">
            选择多个批次进行参数对比分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
            全选
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              历史批次列表
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {batches.map((batch) => {
                const material = getMaterialById(batch.materialId);
                const isSelected = selectedBatchIds.includes(batch.id);
                const isCurrent = currentBatch?.id === batch.id;

                return (
                  <div
                    key={batch.id}
                    onClick={() => toggleBatchSelection(batch.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-slate-700/30 border-slate-600 hover:bg-slate-700/50'
                    } ${isCurrent ? 'ring-2 ring-green-500/50' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-white truncate flex-1">
                        {material?.name || '未知材料'}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${getStatusBadgeClass(
                          batch.status,
                        )}`}
                      >
                        {getStatusLabel(batch.status)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 ml-6 space-y-1">
                      <div className="flex justify-between">
                        <span>床温: {batch.bedTemp}°C</span>
                        <span>喷嘴: {batch.nozzleTemp}°C</span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          尺寸: {batch.modelWidth}×{batch.modelHeight}×{batch.modelDepth}
                        </span>
                        <span>冷却: {batch.coolingFanSpeed}%</span>
                      </div>
                      <div className="text-gray-500">
                        #{batch.id.slice(-6)} | {new Date(batch.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isCurrent && (
                      <div className="mt-2 ml-6 text-xs text-green-400 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        当前批次
                      </div>
                    )}
                  </div>
                );
              })}

              {batches.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">📋</div>
                  <div>暂无批次记录</div>
                  <div className="text-sm">前往参数录入页面创建新批次</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedBatches.length > 0 ? (
            <CompareTable batches={selectedBatches} />
          ) : (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-8 flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">⚖️</div>
                <div className="text-xl mb-2">请选择批次进行对比</div>
                <div className="text-sm">从左侧列表选择至少2个批次</div>
                <div className="text-xs text-gray-600 mt-4">
                  提示: 点击批次卡片即可选中/取消选中
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedBatches.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">对比结论</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">最高床温</div>
              <div className="text-lg font-bold text-orange-400">
                {Math.max(...selectedBatches.map((b) => b.bedTemp))}°C
              </div>
            </div>
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">最低床温</div>
              <div className="text-lg font-bold text-blue-400">
                {Math.min(...selectedBatches.map((b) => b.bedTemp))}°C
              </div>
            </div>
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">最大尺寸</div>
              <div className="text-lg font-bold text-purple-400">
                {Math.max(...selectedBatches.map((b) => b.modelWidth))}mm
              </div>
            </div>
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">平均冷却速度</div>
              <div className="text-lg font-bold text-green-400">
                {Math.round(
                  selectedBatches.reduce((sum, b) => sum + b.coolingFanSpeed, 0) /
                    selectedBatches.length
                )}
                %
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
