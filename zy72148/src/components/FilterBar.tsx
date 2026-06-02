import { Search, Filter, X, Download, Upload, RotateCcw } from 'lucide-react';
import { useAllocationStore } from '@/store/useAllocationStore';
import { getUniqueValues, filterRecords } from '@/utils/export';
import { PERSON_TYPE_LABELS, STATUS_LABELS, QUALITY_TYPE_LABELS } from '@/types';
import type { FilterState, RoomAllocation } from '@/types';
import { useMemo } from 'react';

interface FilterBarProps {
  onImport: () => void;
}

export const FilterBar = ({ onImport }: FilterBarProps) => {
  const allocations = useAllocationStore(state => state.allocations);
  const filters = useAllocationStore(state => state.filters);
  const qualityIssues = useAllocationStore(state => state.qualityIssues);
  const setFilters = useAllocationStore(state => state.setFilters);
  const resetFilters = useAllocationStore(state => state.resetFilters);
  const exportCurrent = useAllocationStore(state => state.exportCurrent);

  const tourNames = useMemo(() => getUniqueValues(allocations, 'tourName'), [allocations]);
  const hotelNames = useMemo(() => getUniqueValues(allocations, 'hotelName'), [allocations]);
  const roomTypes = useMemo(() => getUniqueValues(allocations, 'roomType'), [allocations]);

  const filteredCount = useMemo(() => {
    let filtered: RoomAllocation[] = filterRecords(allocations, filters);
    if (filters.qualityFilter) {
      const issueRecordIds = qualityIssues
        .filter(i => i.type === filters.qualityFilter)
        .map(i => i.recordId);
      filtered = filtered.filter(r => issueRecordIds.includes(r.id));
    }
    return filtered.length;
  }, [allocations, filters, qualityIssues]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters({ [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-700" />
          <h3 className="font-serif text-lg font-semibold text-gray-800">筛选条件</h3>
          {hasActiveFilters && (
            <span className="text-xs text-gray-500">
              显示 {filteredCount} / {allocations.length} 条
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            导入数据
          </button>
          <div className="relative group">
            <button className="btn-primary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              导出
            </button>
            <div className="absolute right-0 mt-1 hidden group-hover:block z-50">
              <div className="bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[120px]">
                <button
                  onClick={() => exportCurrent('csv')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                >
                  导出 CSV
                </button>
                <button
                  onClick={() => exportCurrent('json')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                >
                  导出 JSON
                </button>
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索巡演、酒店、人员..."
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            className="input-base pl-9"
          />
          {filters.searchText && (
            <button
              onClick={() => handleFilterChange('searchText', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        <select
          value={filters.tourName}
          onChange={(e) => handleFilterChange('tourName', e.target.value)}
          className="input-base"
        >
          <option value="">全部巡演</option>
          {tourNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={filters.hotelName}
          onChange={(e) => handleFilterChange('hotelName', e.target.value)}
          className="input-base"
        >
          <option value="">全部酒店</option>
          {hotelNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={filters.roomType}
          onChange={(e) => handleFilterChange('roomType', e.target.value)}
          className="input-base"
        >
          <option value="">全部房型</option>
          {roomTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <select
          value={filters.personType}
          onChange={(e) => handleFilterChange('personType', e.target.value)}
          className="input-base"
        >
          <option value="">全部人员类型</option>
          {Object.entries(PERSON_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="input-base"
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filters.qualityFilter}
          onChange={(e) => handleFilterChange('qualityFilter', e.target.value)}
          className="input-base"
        >
          <option value="">全部数据质量</option>
          {Object.entries(QUALITY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
