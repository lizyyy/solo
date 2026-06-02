import { Search, Filter, X } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { cn } from '@/lib/utils';

const statusOptions = [
  { value: 'imported', label: '已导入' },
  { value: 'abnormal', label: '机构简称异常' },
  { value: 'conflict', label: '数据冲突' },
  { value: 'resolved', label: '已处理待复核' },
  { value: 'reviewed', label: '已复核' }
];

export function FilterBar() {
  const { filters, setFilters } = useDashboardStore();

  const handleStatusChange = (value: string) => {
    const newStatus = filters.status.includes(value)
      ? filters.status.filter(s => s !== value)
      : [...filters.status, value];
    setFilters({ status: newStatus });
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      hasConflict: null,
      nameConsistent: null,
      searchText: ''
    });
  };

  const hasActiveFilters = 
    filters.status.length > 0 || 
    filters.hasConflict !== null || 
    filters.nameConsistent !== null ||
    filters.searchText;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">筛选条件</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            清除筛选
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-500">搜索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.searchText}
              onChange={(e) => setFilters({ searchText: e.target.value })}
              placeholder="搜索机构代码或名称..."
              className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-gray-500">状态</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(option => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  filters.status.includes(option.value)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">数据冲突</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ hasConflict: filters.hasConflict === true ? null : true })}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  filters.hasConflict === true
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                有冲突
              </button>
              <button
                onClick={() => setFilters({ hasConflict: filters.hasConflict === false ? null : false })}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  filters.hasConflict === false
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                无冲突
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-500">机构简称</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ nameConsistent: filters.nameConsistent === false ? null : false })}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  filters.nameConsistent === false
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                不一致
              </button>
              <button
                onClick={() => setFilters({ nameConsistent: filters.nameConsistent === true ? null : true })}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  filters.nameConsistent === true
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                一致
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
