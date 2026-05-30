import { useReconciliationStore } from '@/store'
import { getBrokers } from '@/mockData'
import { DIFF_TYPE_LABELS, STATUS_LABELS, MARKET_LABELS } from '@/types'
import type { DiffType, ReconciliationStatus, Market } from '@/types'
import { RotateCcw } from 'lucide-react'

export default function FilterPanel() {
  const { filters, setFilters, resetFilters } = useReconciliationStore()
  const brokers = getBrokers()

  const toggleBroker = (id: string) => {
    const next = filters.brokerIds.includes(id)
      ? filters.brokerIds.filter(b => b !== id)
      : [...filters.brokerIds, id]
    setFilters({ brokerIds: next })
  }

  const toggleDiffType = (dt: DiffType) => {
    const next = filters.diffTypes.includes(dt)
      ? filters.diffTypes.filter(d => d !== dt)
      : [...filters.diffTypes, dt]
    setFilters({ diffTypes: next })
  }

  const toggleStatus = (s: ReconciliationStatus) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(st => st !== s)
      : [...filters.statuses, s]
    setFilters({ statuses: next })
  }

  const toggleMarket = (m: Market) => {
    const next = filters.markets.includes(m)
      ? filters.markets.filter(mk => mk !== m)
      : [...filters.markets, m]
    setFilters({ markets: next })
  }

  return (
    <div className="filter-panel w-64 flex-shrink-0 h-full overflow-y-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">筛选条件</h2>
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RotateCcw size={12} />
          重置
        </button>
      </div>

      <div>
        <div className="filter-section-title">经纪商</div>
        <div className="flex flex-wrap gap-1.5">
          {brokers.map(b => (
            <button
              key={b.id}
              onClick={() => toggleBroker(b.id)}
              className={`filter-chip ${filters.brokerIds.includes(b.id) ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="filter-section-title">差异类型</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(DIFF_TYPE_LABELS) as [DiffType, string][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleDiffType(k)}
              className={`filter-chip ${filters.diffTypes.includes(k) ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="filter-section-title">处理状态</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(STATUS_LABELS) as [ReconciliationStatus, string][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleStatus(k)}
              className={`filter-chip ${filters.statuses.includes(k) ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="filter-section-title">市场</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(MARKET_LABELS) as [Market, string][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleMarket(k)}
              className={`filter-chip ${filters.markets.includes(k) ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="filter-section-title">日期范围</div>
        <div className="space-y-2">
          <input
            type="date"
            value={filters.dateRange?.[0] ?? ''}
            onChange={e => {
              const start = e.target.value
              const end = filters.dateRange?.[1] ?? ''
              setFilters({ dateRange: start || end ? [start || end, end || start] : null })
            }}
            className="w-full bg-slate-800 border border-slate-600/50 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="date"
            value={filters.dateRange?.[1] ?? ''}
            onChange={e => {
              const start = filters.dateRange?.[0] ?? ''
              const end = e.target.value
              setFilters({ dateRange: start || end ? [start || end, end || start] : null })
            }}
            className="w-full bg-slate-800 border border-slate-600/50 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>
    </div>
  )
}
