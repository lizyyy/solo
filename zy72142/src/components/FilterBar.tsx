import { Search, X } from 'lucide-react';
import type { FilterOptions, AnomalyType } from '../types';
import { ANOMALY_LABELS } from '../types';

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({ filters, onFilterChange, totalCount, filteredCount }: FilterBarProps) {
  const handleReset = () => {
    onFilterChange({
      search: '',
      status: 'all',
      anomalyType: 'all',
    });
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.anomalyType !== 'all';

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索曲目、艺术家、ISRC、备注..."
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A3A]/50 focus:border-[#1E3A3A]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">状态：</label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value as FilterOptions['status'] })}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A3A]/50 focus:border-[#1E3A3A]"
            >
              <option value="all">全部</option>
              <option value="normal">正常</option>
              <option value="anomaly">异常</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">异常类型：</label>
            <select
              value={filters.anomalyType}
              onChange={(e) => onFilterChange({ ...filters, anomalyType: e.target.value as AnomalyType | 'all' })}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A3A]/50 focus:border-[#1E3A3A]"
            >
              <option value="all">全部</option>
              {Object.entries(ANOMALY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
              清除筛选
            </button>
          )}

          <div className="ml-auto text-sm text-gray-500">
            显示 <span className="font-medium text-[#1E3A3A]">{filteredCount}</span> / {totalCount} 条
          </div>
        </div>
      </div>
    </div>
  );
}
