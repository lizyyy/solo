import { useAppStore } from '../store/appStore';
import { ANOMALY_LABELS, FIELD_LABELS } from '../data/mockData';
import { AnomalyType, DataStatus, FieldType } from '../types';

export default function FilterPanel() {
  const {
    filters,
    routes,
    aircraft,
    setDateRange,
    setStatusFilter,
    toggleAnomalyFilter,
    toggleRouteFilter,
    setLoadFactorRange,
    setEmissionRange,
    resetFilters,
    setTimeRange,
    currentTimeRange,
  } = useAppStore();

  // const aircraftModels = [...new Set(aircraft.map(a => a.model))];

  const timeRanges = ['1月', '2月', '3月', 'Q1'];

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 space-y-4 text-white overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">筛选条件</h2>
        <button
          onClick={resetFilters}
          className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
        >
          重置
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">时间范围</label>
        <div className="flex gap-2 flex-wrap">
          {timeRanges.map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                currentTimeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <label className="text-xs text-slate-400">开始日期</label>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => setDateRange(e.target.value, filters.dateRange.end)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">结束日期</label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => setDateRange(filters.dateRange.start, e.target.value)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">数据状态</label>
        <div className="flex gap-2">
          {(['all', 'confirmed', 'tentative'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as DataStatus | 'all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filters.statusFilter === status
                  ? status === 'confirmed' 
                    ? 'bg-blue-600 text-white'
                    : status === 'tentative'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {status === 'all' ? '全部' : status === 'confirmed' ? '已确认' : '临时'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">异常类型</label>
        <div className="space-y-1">
          {(Object.keys(ANOMALY_LABELS) as AnomalyType[]).map(anomaly => (
            <label key={anomaly} className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={filters.anomalyFilter.includes(anomaly)}
                onChange={() => toggleAnomalyFilter(anomaly)}
                className="rounded bg-slate-700 border-slate-600"
              />
              <span className="text-sm">{ANOMALY_LABELS[anomaly]}</span>
              <span className="text-xs text-amber-400 ml-auto">回归样例</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">航线筛选</label>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {routes.map(route => (
            <label key={route.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={filters.routes.includes(route.id)}
                onChange={() => toggleRouteFilter(route.id)}
                className="rounded bg-slate-700 border-slate-600"
              />
              <span className="text-sm truncate">
                {route.origin} - {route.destination}
              </span>
              <span className={`text-xs ml-auto px-1 rounded ${
                route.status === 'confirmed' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'
              }`}>
                {route.status === 'confirmed' ? '已确认' : '临时'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">
          载客率范围: {filters.loadFactorRange.min}% - {filters.loadFactorRange.max}%
        </label>
        <div className="flex gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={filters.loadFactorRange.min}
            onChange={(e) => setLoadFactorRange(Number(e.target.value), filters.loadFactorRange.max)}
            className="flex-1"
          />
          <input
            type="range"
            min="0"
            max="100"
            value={filters.loadFactorRange.max}
            onChange={(e) => setLoadFactorRange(filters.loadFactorRange.min, Number(e.target.value))}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">
          碳排范围: {filters.emissionRange.min} - {filters.emissionRange.max} kg
        </label>
        <div className="flex gap-2">
          <input
            type="range"
            min="0"
            max="100000"
            step="1000"
            value={filters.emissionRange.min}
            onChange={(e) => setEmissionRange(Number(e.target.value), filters.emissionRange.max)}
            className="flex-1"
          />
          <input
            type="range"
            min="0"
            max="100000"
            step="1000"
            value={filters.emissionRange.max}
            onChange={(e) => setEmissionRange(filters.emissionRange.min, Number(e.target.value))}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">图例说明</label>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-b from-emerald-500 to-emerald-700 rounded"></div>
            <span>低碳排放</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-b from-amber-500 to-amber-700 rounded"></div>
            <span>中碳排放</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-b from-red-500 to-red-700 rounded"></div>
            <span>高碳排放</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded opacity-70"></div>
            <span>临时数据</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 rounded"></div>
            <span>异常标注</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-700">
        <label className="text-sm text-slate-300">字段状态说明</label>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {(Object.keys(FIELD_LABELS) as FieldType[]).map(field => (
            <div key={field} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>{FIELD_LABELS[field]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
