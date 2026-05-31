import { useStore } from '@/store/useStore'
import { Search, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterState } from '@/types'

interface FilterPanelProps {
  filters?: FilterState
  onFilterChange?: (filters: Partial<FilterState>) => void
  onReset?: () => void
}

export default function FilterPanel({ filters: propsFilters, onFilterChange, onReset }: FilterPanelProps) {
  const storeFilters = useStore((state) => state.filters)
  const storeSetFilters = useStore((state) => state.setFilters)
  const storeResetFilters = useStore((state) => state.resetFilters)

  const filters = propsFilters || storeFilters
  const setFilters = onFilterChange || storeSetFilters
  const resetFilters = onReset || storeResetFilters

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">筛选条件</h3>
        <button
          onClick={resetFilters}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          重置筛选
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            搜索
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="搜索文物名称、编号、修复师..."
              className={cn(
                'w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg',
                'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
                'text-sm'
              )}
            />
            {filters.search && (
              <button
                onClick={() => setFilters({ search: '' })}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            状态
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              'text-sm'
            )}
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="archived">已归档</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            保险状态
          </label>
          <select
            value={filters.insuranceStatus}
            onChange={(e) => setFilters({ insuranceStatus: e.target.value as 'all' | 'linked' | 'missing' })}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              'text-sm'
            )}
          >
            <option value="all">全部</option>
            <option value="linked">已关联</option>
            <option value="missing">未关联</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            灯光状态
          </label>
          <select
            value={filters.lightingStatus}
            onChange={(e) => setFilters({ lightingStatus: e.target.value as 'all' | 'linked' | 'missing' })}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              'text-sm'
            )}
          >
            <option value="all">全部</option>
            <option value="linked">已关联</option>
            <option value="missing">未关联</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            展览状态
          </label>
          <select
            value={filters.exhibitionStatus}
            onChange={(e) => setFilters({ exhibitionStatus: e.target.value as 'all' | 'linked' | 'missing' })}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              'text-sm'
            )}
          >
            <option value="all">全部</option>
            <option value="linked">已关联</option>
            <option value="missing">未关联</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            创建日期从
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              'text-sm'
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            创建日期至
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ dateTo: e.target.value })}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              'text-sm'
            )}
          />
        </div>
      </div>
    </div>
  )
}
