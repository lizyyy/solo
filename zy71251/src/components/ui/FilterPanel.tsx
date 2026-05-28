import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import useStore from '../../store/useStore';

const zoneOptions = [
  { value: 'normal', label: '普通区域' },
  { value: 'constant_temp', label: '恒温区域' },
  { value: 'valuables', label: '贵重品区' }
];

const statusOptions = [
  { value: 'occupied', label: '已占用' },
  { value: 'empty', label: '空置' },
  { value: 'reserved', label: '已预约' },
  { value: 'maintenance', label: '维护中' }
];

const artworkTypeOptions = [
  { value: 'oil', label: '油画' },
  { value: 'chinese', label: '国画' },
  { value: 'sculpture', label: '雕塑' },
  { value: 'photography', label: '摄影' },
  { value: 'mixed', label: '综合材料' }
];

export default function FilterPanel() {
  const { filters, setFilters, getFilteredLocations } = useStore();
  const [expanded, setExpanded] = useState({
    zones: true,
    status: true,
    artworkType: true,
    temp: true,
    humidity: true
  });
  const filteredCount = getFilteredLocations().length;

  const toggleExpand = (key: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleZoneToggle = (value: string) => {
    const newZones = filters.zones.includes(value)
      ? filters.zones.filter(z => z !== value)
      : [...filters.zones, value];
    setFilters({ zones: newZones });
  };

  const handleStatusToggle = (value: string) => {
    const newStatuses = filters.statuses.includes(value)
      ? filters.statuses.filter(s => s !== value)
      : [...filters.statuses, value];
    setFilters({ statuses: newStatuses });
  };

  const handleArtworkTypeToggle = (value: string) => {
    const newTypes = filters.artworkTypes.includes(value)
      ? filters.artworkTypes.filter(t => t !== value)
      : [...filters.artworkTypes, value];
    setFilters({ artworkTypes: newTypes });
  };

  const clearFilters = () => {
    setFilters({
      searchKeyword: '',
      zones: [],
      statuses: [],
      artworkTypes: [],
      tempRange: [15, 30],
      humidityRange: [30, 80],
      showAlertsOnly: false
    });
  };

  const hasActiveFilters = filters.zones.length > 0 || 
    filters.statuses.length > 0 || 
    filters.artworkTypes.length > 0 || 
    filters.showAlertsOnly ||
    filters.tempRange[0] !== 15 || 
    filters.tempRange[1] !== 30 ||
    filters.humidityRange[0] !== 30 || 
    filters.humidityRange[1] !== 80;

  return (
    <div className="w-72 bg-slate-900/90 backdrop-blur-md border-r border-slate-700/50 h-full flex flex-col">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Filter size={18} />
            筛选条件
          </h2>
          <span className="text-sm text-slate-400">
            结果: <span className="text-blue-400 font-mono">{filteredCount}</span>
          </span>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="搜索作品、库位、编号..."
            value={filters.searchKeyword}
            onChange={(e) => setFilters({ searchKeyword: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            checked={filters.showAlertsOnly}
            onChange={(e) => setFilters({ showAlertsOnly: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500"
          />
          <span className="text-sm text-slate-300">仅显示有告警的库位</span>
        </label>

        <div className="space-y-2">
          <button
            onClick={() => toggleExpand('zones')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            区域类型
            {expanded.zones ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded.zones && (
            <div className="space-y-1 pl-2">
              {zoneOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.zones.includes(opt.value)}
                    onChange={() => handleZoneToggle(opt.value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-400">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleExpand('status')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            库位状态
            {expanded.status ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded.status && (
            <div className="space-y-1 pl-2">
              {statusOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(opt.value)}
                    onChange={() => handleStatusToggle(opt.value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-400">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleExpand('artworkType')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            作品类型
            {expanded.artworkType ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded.artworkType && (
            <div className="space-y-1 pl-2">
              {artworkTypeOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-800/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.artworkTypes.includes(opt.value)}
                    onChange={() => handleArtworkTypeToggle(opt.value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-400">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleExpand('temp')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            温度范围 (°C)
            {expanded.temp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded.temp && (
            <div className="space-y-3 pl-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.tempRange[0]}
                  onChange={(e) => setFilters({ tempRange: [Number(e.target.value), filters.tempRange[1]] })}
                  className="w-20 px-2 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-500">—</span>
                <input
                  type="number"
                  value={filters.tempRange[1]}
                  onChange={(e) => setFilters({ tempRange: [filters.tempRange[0], Number(e.target.value)] })}
                  className="w-20 px-2 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="10"
                max="35"
                value={filters.tempRange[0]}
                onChange={(e) => setFilters({ tempRange: [Number(e.target.value), Math.max(Number(e.target.value), filters.tempRange[1])] })}
                className="w-full accent-blue-500"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleExpand('humidity')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            湿度范围 (%)
            {expanded.humidity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded.humidity && (
            <div className="space-y-3 pl-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filters.humidityRange[0]}
                  onChange={(e) => setFilters({ humidityRange: [Number(e.target.value), filters.humidityRange[1]] })}
                  className="w-20 px-2 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-500">—</span>
                <input
                  type="number"
                  value={filters.humidityRange[1]}
                  onChange={(e) => setFilters({ humidityRange: [filters.humidityRange[0], Number(e.target.value)] })}
                  className="w-20 px-2 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <input
                type="range"
                min="20"
                max="90"
                value={filters.humidityRange[0]}
                onChange={(e) => setFilters({ humidityRange: [Number(e.target.value), Math.max(Number(e.target.value), filters.humidityRange[1])] })}
                className="w-full accent-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={clearFilters}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm"
          >
            <X size={16} />
            清除所有筛选
          </button>
        </div>
      )}
    </div>
  );
}
