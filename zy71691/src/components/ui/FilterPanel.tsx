import { RotateCcw, Box, Construction, Truck, AlertTriangle } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';
import type { ContainerType, SlotStatus, CraneStatus, TruckStatus, ConflictType } from '@/types';

const containerTypeOptions: { value: ContainerType; label: string; color: string }[] = [
  { value: 'dry', label: '干货箱', color: 'bg-blue-500' },
  { value: 'reefer', label: '冷藏箱', color: 'bg-cyan-500' },
  { value: 'hazardous', label: '危险品箱', color: 'bg-red-500' },
];

const slotStatusOptions: { value: SlotStatus; label: string; color: string }[] = [
  { value: 'occupied', label: '已占用', color: 'bg-green-500' },
  { value: 'empty', label: '空箱位', color: 'bg-gray-500' },
  { value: 'reserved', label: '已预留', color: 'bg-yellow-500' },
];

const craneStatusOptions: { value: CraneStatus; label: string; color: string }[] = [
  { value: 'working', label: '作业中', color: 'bg-green-500' },
  { value: 'idle', label: '空闲', color: 'bg-gray-500' },
  { value: 'maintenance', label: '维护中', color: 'bg-red-500' },
];

const truckStatusOptions: { value: TruckStatus; label: string; color: string }[] = [
  { value: 'moving', label: '行驶中', color: 'bg-blue-500' },
  { value: 'loading', label: '装卸中', color: 'bg-yellow-500' },
  { value: 'waiting', label: '等待', color: 'bg-gray-500' },
  { value: 'unloading', label: '卸货中', color: 'bg-orange-500' },
];

const conflictTypeOptions: { value: ConflictType; label: string }[] = [
  { value: 'slot_overlap', label: '箱位重叠' },
  { value: 'crane_collision', label: '吊机冲突' },
  { value: 'route_blockage', label: '路线堵塞' },
  { value: 'port_congestion', label: '压港风险' },
];

export function FilterPanel() {
  const { filters, setFilters, resetFilters } = useYardStore();

  const toggleFilter = <T,>(key: keyof typeof filters, value: T) => {
    const currentFilters = filters[key] as T[];
    const newFilters = currentFilters.includes(value)
      ? currentFilters.filter((v) => v !== value)
      : [...currentFilters, value];
    setFilters({ [key]: newFilters } as Partial<typeof filters>);
  };

  const isActive = <T,>(key: keyof typeof filters, value: T) => {
    return (filters[key] as T[]).includes(value);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">筛选条件</h3>
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Box className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">集装箱类型</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {containerTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleFilter('containerTypes', option.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                isActive('containerTypes', option.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${option.color}`} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Box className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">箱位状态</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {slotStatusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleFilter('slotStatuses', option.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                isActive('slotStatuses', option.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${option.color}`} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Construction className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">吊机状态</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {craneStatusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleFilter('craneStatuses', option.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                isActive('craneStatuses', option.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${option.color}`} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Truck className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">卡车状态</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {truckStatusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleFilter('truckStatuses', option.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                isActive('truckStatuses', option.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${option.color}`} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300">冲突类型</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {conflictTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleFilter('conflictTypes', option.value)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                isActive('conflictTypes', option.value)
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showConflictsOnly}
            onChange={(e) => setFilters({ showConflictsOnly: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">仅显示有冲突的对象</span>
        </label>
      </div>
    </div>
  );
}
