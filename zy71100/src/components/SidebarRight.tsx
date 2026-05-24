import { BarChart3, Activity, Flame, Sliders } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getHeatmapColorStops } from '../utils/heatmap';
import { calculateTotalDistance, calculateAvgSpeed } from '../utils/path';
import { calculateHeatmap } from '../utils/heatmap';

export function SidebarRight() {
  const {
    timeRange,
    heatmapIntensity,
    setHeatmapIntensity,
    rightPanelOpen,
    selectedOrders,
    pickingOrders,
    aisles,
  } = useStore();

  const visibleOrders = selectedOrders.length === 0
    ? pickingOrders
    : pickingOrders.filter((o) => selectedOrders.includes(o.id));

  const filteredOrders = visibleOrders.filter(
    (order) => order.startTime >= timeRange.start && order.endTime <= timeRange.end
  );

  const totalDistance = calculateTotalDistance(filteredOrders);
  const avgSpeed = calculateAvgSpeed(filteredOrders);

  const heatmapData = calculateHeatmap(filteredOrders, aisles, timeRange, 1, heatmapIntensity);
  const maxHeatValue = Math.max(...heatmapData.map((d) => d.value), 1);

  const aisleStats = aisles.map((aisle) => {
    const relatedHeat = heatmapData.filter((cell) => {
      const halfWidth = aisle.width / 2 + 2;
      if (aisle.orientation === 'z') {
        return (
          cell.x >= aisle.x1 - halfWidth &&
          cell.x <= aisle.x1 + halfWidth &&
          cell.z >= Math.min(aisle.z1, aisle.z2) &&
          cell.z <= Math.max(aisle.z1, aisle.z2)
        );
      } else {
        return (
          cell.z >= aisle.z1 - halfWidth &&
          cell.z <= aisle.z1 + halfWidth &&
          cell.x >= Math.min(aisle.x1, aisle.x2) &&
          cell.x <= Math.max(aisle.x1, aisle.x2)
        );
      }
    });
    const totalHeat = relatedHeat.reduce((sum, cell) => sum + cell.value, 0);
    return { aisle, heat: totalHeat };
  }).sort((a, b) => b.heat - a.heat);

  const colorStops = getHeatmapColorStops();

  if (!rightPanelOpen) return null;

  return (
    <div className="absolute top-14 right-0 bottom-24 w-72 bg-slate-900/90 backdrop-blur-sm border-l border-slate-700 flex flex-col z-10">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          热力分析
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4" />
            热力图例
          </h3>
          <div className="h-6 rounded overflow-hidden flex">
            {colorStops.map((stop, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  background: `linear-gradient(to right, ${stop.color}, ${colorStops[i + 1]?.color || stop.color})`,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>低</span>
            <span>高</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            热力强度
          </h3>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={heatmapIntensity}
            onChange={(e) => setHeatmapIntensity(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-slate-500 mt-1 text-right">
            {heatmapIntensity.toFixed(1)}x
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            统计概览
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-2xl font-bold text-white">{filteredOrders.length}</div>
              <div className="text-xs text-slate-500">拣货单</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-2xl font-bold text-blue-400">{totalDistance.toFixed(0)}</div>
              <div className="text-xs text-slate-500">总距离(m)</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-2xl font-bold text-green-400">{avgSpeed.toFixed(2)}</div>
              <div className="text-xs text-slate-500">平均速度(m/s)</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="text-2xl font-bold text-amber-400">{heatmapData.length}</div>
              <div className="text-xs text-slate-500">热力单元</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">拥堵巷道排名</h3>
          <div className="space-y-2">
            {aisleStats.slice(0, 5).map(({ aisle, heat }, index) => {
              const intensity = heat / (aisleStats[0]?.heat || 1);
              return (
                <div
                  key={aisle.id}
                  className="p-2 rounded bg-slate-800/50 border border-slate-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                      <span className="text-sm text-white">{aisle.name}</span>
                      {aisle.isNarrow && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300">
                          窄
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{(intensity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${intensity * 100}%`,
                        background: intensity > 0.6
                          ? 'linear-gradient(to right, #f59e0b, #dc2626)'
                          : intensity > 0.3
                          ? 'linear-gradient(to right, #059669, #f59e0b)'
                          : 'linear-gradient(to right, #1e40af, #059669)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-800/50">
          <h4 className="text-sm font-medium text-blue-400 mb-2">💡 分析提示</h4>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• 红色区域表示高拥堵，建议优化路线</li>
            <li>• 窄巷（紫色标记）拥堵系数 x2</li>
            <li>• 拖动时间轴查看不同时段情况</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
