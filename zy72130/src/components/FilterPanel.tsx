import { Filter, X, ArrowUpDown, Calendar } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_LABELS, SOURCE_LABELS, type RecordStatus, type RecordSource, type SortField } from '@/types'

const statuses: (RecordStatus | '')[] = ['', 'smooth', 'needs_confirmation', 'old_standard']
const sources: (RecordSource | '')[] = ['', 'excel', 'audio', 'contract', 'chat_annotation']
const sortFields: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'revenue', label: '票房收入' },
  { value: 'trackName', label: '曲目名' },
]

export default function FilterPanel() {
  const { filter, setFilter } = useStore()

  const hasFilters = filter.status || filter.source || filter.dateFrom || filter.dateTo

  const clearAll = () => {
    setFilter({ status: '', source: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'desc' })
  }

  const toggleSortOrder = () => {
    setFilter({ sortOrder: filter.sortOrder === 'desc' ? 'asc' : 'desc' })
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neon" />
          <span className="text-sm font-medium text-white">筛选</span>
        </div>
        {hasFilters ? (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
          >
            <X className="h-3 w-3" />
            清除全部
          </button>
        ) : null}
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs text-muted block mb-2">状态</label>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilter({ status: s })}
                className={`px-3 py-1 rounded-lg text-xs transition-all duration-200 ${
                  filter.status === s
                    ? 'bg-neon/15 text-neon border border-neon/40 shadow-neon-sm'
                    : 'bg-surface-elevated text-muted border border-surface-border hover:text-gray-300'
                }`}
              >
                {s ? STATUS_LABELS[s] : '全部'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted block mb-2">来源</label>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setFilter({ source: s })}
                className={`px-3 py-1 rounded-lg text-xs transition-all duration-200 ${
                  filter.source === s
                    ? 'bg-neon/15 text-neon border border-neon/40 shadow-neon-sm'
                    : 'bg-surface-elevated text-muted border border-surface-border hover:text-gray-300'
                }`}
              >
                {s ? SOURCE_LABELS[s] : '全部'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted block mb-2 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            日期范围
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ dateFrom: e.target.value })}
                className="flex-1 px-2 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs text-white focus:outline-none focus:border-neon/50"
              />
              <span className="text-xs text-muted">至</span>
              <input
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ dateTo: e.target.value })}
                className="flex-1 px-2 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs text-white focus:outline-none focus:border-neon/50"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted block mb-2 flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" />
            排序
          </label>
          <div className="flex items-center gap-2">
            <select
              value={filter.sortBy}
              onChange={(e) => setFilter({ sortBy: e.target.value as SortField })}
              className="flex-1 px-2 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs text-white focus:outline-none focus:border-neon/50"
            >
              {sortFields.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              onClick={toggleSortOrder}
              className="px-3 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs text-muted hover:text-white hover:border-neon/40 transition-colors"
              title={filter.sortOrder === 'desc' ? '降序' : '升序'}
            >
              {filter.sortOrder === 'desc' ? '↓ 降序' : '↑ 升序'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
