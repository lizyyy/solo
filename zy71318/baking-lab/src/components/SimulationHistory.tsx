import type { SimulationResult } from '../types';
import { TARGET_CENTER_TEMPERATURE } from '../data/materials';

interface SimulationHistoryProps {
  simulations: SimulationResult[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onExportReport: (id: string) => void;
  onExportChart: (ids: string[]) => void;
}

export const SimulationHistory: React.FC<SimulationHistoryProps> = ({
  simulations,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onRemove,
  onClearAll,
  onExportReport,
  onExportChart
}) => {
  if (simulations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <div className="text-lg">暂无模拟记录</div>
          <div className="text-sm mt-2">运行模拟后将在此处显示历史记录</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">模拟历史</h3>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            全选
          </button>
          <button
            onClick={onDeselectAll}
            className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
          >
            取消
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={() => onExportChart(selectedIds)}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            >
              导出CSV
            </button>
          )}
          <button
            onClick={onClearAll}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {simulations.slice().reverse().map((sim) => (
          <div
            key={sim.id}
            className={`p-4 rounded-lg border transition-all cursor-pointer ${
              selectedIds.includes(sim.id)
                ? 'bg-blue-900/30 border-blue-500'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'
            }`}
            onClick={() => onToggleSelect(sim.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sim.material.color }}
                />
                <div>
                  <div className="font-medium text-white">{sim.material.name}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(sim.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onExportReport(sim.id)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="导出报告"
                >
                  📄
                </button>
                <button
                  onClick={() => onRemove(sim.id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-400">
                烤箱温度: <span className="text-gray-200">{sim.params.ovenTemperature}°C</span>
              </div>
              <div className="text-gray-400">
                蛋糕尺寸: <span className="text-gray-200">{sim.params.cakeDimensions.diameter}×{sim.params.cakeDimensions.height}cm</span>
              </div>
              <div className="text-gray-400">
                最高温度: <span className="text-orange-400 font-medium">{sim.maxTemperature.toFixed(1)}°C</span>
              </div>
              <div className="text-gray-400">
                达到{TARGET_CENTER_TEMPERATURE}°C: <span className="text-green-400 font-medium">
                  {sim.timeToTargetTemp ? `${sim.timeToTargetTemp.toFixed(0)}秒` : '未达到'}
                </span>
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              📚 材料来源: {sim.material.source}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-sm text-gray-400">
          共 {simulations.length} 条记录，已选择 {selectedIds.length} 条
        </div>
      </div>
    </div>
  );
};
