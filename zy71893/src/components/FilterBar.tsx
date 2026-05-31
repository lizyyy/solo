import { useDeviationStore } from '@/store/useDeviationStore'
import { DEVIATION_TYPE_LABELS, RECORD_STATUS_LABELS, RECORD_SOURCE_LABELS } from '@/types'
import type { DeviationType, RecordStatus, RecordSource } from '@/types'
import { Search, X, Filter } from 'lucide-react'

const inputCls =
  'bg-slate-card border border-iron-lighter text-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-signal'

export default function FilterBar() {
  const { filters, setFilter, resetFilters } = useDeviationStore()

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-card rounded-lg border border-iron-lighter">
      <div className="flex items-center gap-1.5 text-slate-400 text-sm">
        <Filter size={16} />
        <span>筛选</span>
      </div>

      <select
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value)}
        className={inputCls}
      >
        <option value="">全部状态</option>
        {(Object.entries(RECORD_STATUS_LABELS) as [RecordStatus, string][]).map(
          ([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ),
        )}
      </select>

      <select
        value={filters.deviationType}
        onChange={(e) => setFilter('deviationType', e.target.value)}
        className={inputCls}
      >
        <option value="">全部类型</option>
        {(Object.entries(DEVIATION_TYPE_LABELS) as [DeviationType, string][]).map(
          ([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ),
        )}
      </select>

      <select
        value={filters.source}
        onChange={(e) => setFilter('source', e.target.value)}
        className={inputCls}
      >
        <option value="">全部来源</option>
        {(Object.entries(RECORD_SOURCE_LABELS) as [RecordSource, string][]).map(
          ([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ),
        )}
      </select>

      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => setFilter('dateFrom', e.target.value)}
        className={inputCls}
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => setFilter('dateTo', e.target.value)}
        className={inputCls}
      />

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={filters.keyword}
          onChange={(e) => setFilter('keyword', e.target.value)}
          placeholder="搜索编号/设备/描述..."
          className={`${inputCls} pl-8 w-56`}
        />
      </div>

      <button
        onClick={resetFilters}
        className="text-slate-400 hover:text-signal transition-colors text-sm flex items-center gap-1"
      >
        <X size={14} />
        重置
      </button>
    </div>
  )
}
