import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Filter, AlertTriangle, Copy, AlertCircle, MapPin, Clock } from 'lucide-react';
import { useFormationStore } from '@/store/formationStore';
import { useUIStore } from '@/store/uiStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SourceBadge } from '@/components/common/SourceBadge';
import { STATUS_LABELS, type StatusType } from '@/types';

const statusFilters: Array<{ key: StatusType | 'ALL'; label: string; count?: number }> = [
  { key: 'ALL', label: '全部' },
  { key: 'NORMAL', label: '正常' },
  { key: 'WARNING', label: '预警' },
  { key: 'CONFIRM', label: '待确认' },
  { key: 'HISTORY', label: '历史口径' },
  { key: 'ERROR', label: '数据错误' },
  { key: 'DUPLICATE', label: '重复项' },
  { key: 'BOUNDARY', label: '边界异常' },
];

export function DataPanel() {
  const { leftPanelCollapsed, toggleLeftPanel } = useUIStore();
  const { drones, selectedDroneId, statusFilter, setStatusFilter, selectDrone, focusDrone } = useFormationStore();
  const [searchText, setSearchText] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const getFilteredDrones = () => {
    let filtered = drones;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.id.toLowerCase().includes(lower) ||
          d.name.toLowerCase().includes(lower) ||
          d.source.name.toLowerCase().includes(lower)
      );
    }
    return filtered;
  };

  const filteredDrones = getFilteredDrones();

  const getStatusCount = (status: StatusType | 'ALL') => {
    if (status === 'ALL') return drones.length;
    return drones.filter((d) => d.status === status).length;
  };

  if (leftPanelCollapsed) {
    return (
      <div className="w-10 bg-[#0f1e36] border-r border-white/10 flex flex-col items-center py-4">
        <button
          onClick={toggleLeftPanel}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="展开面板"
        >
          <ChevronRight size={18} />
        </button>
        <div className="mt-4 space-y-2">
          {statusFilters.slice(1).map((filter) => {
            const count = getStatusCount(filter.key as StatusType);
            if (count === 0) return null;
            return (
              <div
                key={filter.key}
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold cursor-pointer transition-colors ${
                  statusFilter === filter.key ? 'bg-blue-500/30 text-blue-400' : 'bg-white/5 text-gray-500 hover:bg-white/10'
                }`}
                onClick={() => setStatusFilter(filter.key as StatusType)}
                title={`${filter.label}: ${count}`}
              >
                {count}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-[#0f1e36] border-r border-white/10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <MapPin size={16} className="text-blue-400" />
            编队列表
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            共 {drones.length} 架，显示 {filteredDrones.length} 架
          </p>
        </div>
        <button
          onClick={toggleLeftPanel}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="收起面板"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-white/10 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索编号、名称、来源..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#0a1628] border border-white/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {statusFilters.slice(0, 4).map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key as StatusType | 'ALL')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  statusFilter === filter.key
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                    : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                }`}
              >
                {filter.label} ({getStatusCount(filter.key as StatusType | 'ALL')})
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-1.5 rounded transition-colors ${
              showFilter ? 'bg-blue-500/30 text-blue-400' : 'text-gray-500 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            <Filter size={14} />
          </button>
        </div>

        {showFilter && (
          <div className="flex gap-1 flex-wrap pt-1 border-t border-white/5">
            {statusFilters.slice(4).map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key as StatusType)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  statusFilter === filter.key
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                    : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                }`}
              >
                {filter.label} ({getStatusCount(filter.key as StatusType)})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredDrones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <Search size={24} className="mb-2 opacity-50" />
            <p className="text-xs">没有匹配的无人机</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredDrones.map((drone) => (
              <div
                key={drone.id}
                className={`px-3 py-2.5 cursor-pointer transition-colors ${
                  selectedDroneId === drone.id
                    ? 'bg-blue-500/20 border-l-2 border-blue-500'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                }`}
                onClick={() => selectDrone(drone.id)}
                onDoubleClick={() => focusDrone(drone.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white font-mono truncate">
                        {drone.id}
                      </span>
                      {drone.isDuplicate && (
                        <Copy size={12} className="text-purple-400 flex-shrink-0" />
                      )}
                      {drone.isBoundary && (
                        <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{drone.name}</p>
                  </div>
                  <StatusBadge status={drone.status} pulse />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <SourceBadge type={drone.source.type} />
                  <span className="text-[10px] text-gray-500 truncate">
                    {drone.source.reference}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="font-mono">
                        {drone.position.x.toFixed(1)}, {drone.position.y.toFixed(1)}, {drone.position.z.toFixed(1)}
                      </span>
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-medium ${
                      drone.obstacleDistance < 0
                        ? 'text-red-400'
                        : drone.obstacleDistance < 3
                        ? 'text-red-400'
                        : drone.obstacleDistance < 5
                        ? 'text-orange-400'
                        : 'text-green-400'
                    }`}
                  >
                    {drone.obstacleDistance >= 0 ? `${drone.obstacleDistance.toFixed(1)}m` : '无效'}
                  </span>
                </div>

                {drone.currentNote && (
                  <div className="mt-2 px-2 py-1 bg-black/20 rounded">
                    <p className="text-[10px] text-gray-400 line-clamp-2">{drone.currentNote}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/10 bg-[#0a1628]">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            最后更新: {drones.length > 0 ? new Date(Math.max(...drones.map((d) => new Date(d.updatedAt).getTime()))).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
