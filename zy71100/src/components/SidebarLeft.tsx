import { Package, Truck, Filter, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export function SidebarLeft() {
  const { selectedOrders, selectOrder, clearSelection, timeRange, setTimeRange, leftPanelOpen, pickingOrders, aisles } = useStore();

  const vehicleTypeLabels: Record<string, string> = {
    forklift: '叉车',
    picker: '拣货车',
    manual: '人工',
  };

  const filteredOrders = pickingOrders.filter(
    (order) => order.startTime >= timeRange.start && order.endTime <= timeRange.end
  );

  if (!leftPanelOpen) return null;

  return (
    <div className="absolute top-14 left-0 bottom-24 w-72 bg-slate-900/90 backdrop-blur-sm border-r border-slate-700 flex flex-col z-10">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-400" />
          筛选面板
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">时间范围</h3>
          <div className="space-y-2">
            <div className="text-xs text-slate-300">
              开始: {new Date(timeRange.start).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-slate-300">
              结束: {new Date(timeRange.end).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              拣货单列表
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              清除选择
            </button>
          </h3>
          <p className="text-xs text-slate-500 mb-2">点击选中，Shift 多选</p>
          <div className="space-y-2">
            {filteredOrders.length === 0 ? (
              <p className="text-sm text-slate-500">当前时间范围内无拣货单</p>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrders.length === 0 || selectedOrders.includes(order.id);
                return (
                  <button
                    key={order.id}
                    onClick={(e) => selectOrder(order.id, e.shiftKey)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'bg-slate-700/50 border-blue-500'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{order.id}</span>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: order.color }}
                        />
                        {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      操作员: {order.operator}
                    </div>
                    <div className="text-xs text-slate-500">
                      {vehicleTypeLabels[order.vehicleType]} · {order.path.length} 个路径点
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            巷道信息
          </h3>
          <div className="space-y-2">
            {aisles.map((aisle) => (
              <div
                key={aisle.id}
                className="p-2 rounded bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{aisle.name}</span>
                  {aisle.isNarrow && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-600/30 text-purple-300">
                      窄巷
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  宽度: {aisle.width}m · 方向: {aisle.orientation === 'z' ? '纵向' : '横向'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
