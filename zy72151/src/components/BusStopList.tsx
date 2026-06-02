import { useState } from 'react';
import { Search, Filter, AlertCircle, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore, useFilteredBusStops } from '@/store/useStore';
import { statusLabels, statusColors, PointStatus } from '@/types';

export default function BusStopList() {
  const { selectedBusStopId, setSelectedBusStop, setFilters, filters } = useStore();
  const filteredStops = useFilteredBusStops();
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions: (PointStatus | 'all')[] = ['all', 'pending', 'confirmed', 'exception', 'merged'];

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-slate-800">点位列表</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="ml-auto p-1.5 rounded hover:bg-slate-100 transition-colors"
          >
            <Filter className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索站点名称..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-600 mb-1 block">状态筛选</label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => setFilters({ status: e.target.value === 'all' ? undefined : e.target.value as PointStatus })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'all' ? '全部状态' : statusLabels[opt]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredStops.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <MapPin className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">没有找到匹配的点位</p>
          </div>
        ) : (
          filteredStops.map((stop) => (
            <button
              key={stop.id}
              onClick={() => setSelectedBusStop(stop.id)}
              className={`w-full p-4 border-b border-slate-100 text-left hover:bg-slate-50 transition-colors ${
                selectedBusStopId === stop.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: statusColors[stop.status] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 truncate">
                      {stop.name || '未命名站点'}
                    </span>
                    {stop.needsReview && (
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                    {stop.isBoundary && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded flex-shrink-0">
                        边界
                      </span>
                    )}
                  </div>
                  {stop.address && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{stop.address}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: `${statusColors[stop.status]}15`,
                        color: statusColors[stop.status],
                      }}
                    >
                      {statusLabels[stop.status]}
                    </span>
                    {stop.mergeSuggestions && stop.mergeSuggestions.length > 0 && (
                      <span className="text-xs text-amber-600">
                        {stop.mergeSuggestions.length} 个相似点位
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-200 text-xs text-slate-500 text-center">
        共 {filteredStops.length} 个点位
      </div>
    </div>
  );
}
