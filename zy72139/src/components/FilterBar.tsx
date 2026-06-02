import { useScheduleStore } from '@/stores/scheduleStore'
import { Search, X, Filter } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待排程' },
  { value: 'scheduled', label: '已排程' },
  { value: 'missing_auth', label: '缺授权' },
  { value: 'version_conflict', label: '版本冲突' },
  { value: 'duplicate', label: '重复项' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-300',
  scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  missing_auth: 'bg-orange-50 text-orange-700 border-orange-300',
  version_conflict: 'bg-pink-50 text-pink-700 border-pink-300',
  duplicate: 'bg-amber-50 text-amber-700 border-amber-300',
}

export { STATUS_COLORS }

export default function FilterBar() {
  const { filters, setFilters, items, fetchSchedules } = useScheduleStore()

  const sources = [...new Set(items.map((i) => i.source))].sort()
  const sourceOptions = [
    { value: '', label: '全部来源' },
    ...sources.map((s) => ({ value: s, label: s })),
  ]

  const activeCount = Object.values(filters).filter((v) => v).length

  return (
    <div className="w-64 min-w-[256px] bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={16} className="text-amber-600" />
          <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">筛选条件</span>
          {activeCount > 0 && (
            <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">状态</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
            value={filters.status}
            onChange={(e) => {
              setFilters({ status: e.target.value })
              setTimeout(() => fetchSchedules(), 0)
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {filters.status && (
            <div className="flex flex-wrap gap-1 mt-2">
              {STATUS_OPTIONS.filter(o => o.value && o.value !== filters.status).map(o => (
                <button
                  key={o.value}
                  onClick={() => {
                    setFilters({ status: o.value })
                    setTimeout(() => fetchSchedules(), 0)
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${STATUS_COLORS[o.value] || 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">来源</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
            value={filters.source}
            onChange={(e) => {
              setFilters({ source: e.target.value })
              setTimeout(() => fetchSchedules(), 0)
            }}
          >
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide uppercase">关键词</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="编号/曲目/文件名/备注"
              className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
              value={filters.keyword}
              onChange={(e) => {
                setFilters({ keyword: e.target.value })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchSchedules()
              }}
            />
            {filters.keyword && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setFilters({ keyword: '' })
                  setTimeout(() => fetchSchedules(), 0)
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-slate-100">
        <button
          onClick={() => {
            setFilters({ status: '', source: '', keyword: '' })
            setTimeout(() => fetchSchedules(), 0)
          }}
          className="w-full text-sm text-slate-500 hover:text-amber-600 transition-colors py-2 rounded-lg hover:bg-amber-50"
        >
          清除所有筛选
        </button>
      </div>
    </div>
  )
}
