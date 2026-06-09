import { Search, CalendarDays } from 'lucide-react'
import type { RecordStatus } from '@shared/types'
import { cn } from '@/lib/utils'

export interface FilterState {
  status: 'all' | RecordStatus
  keyword: string
  startDate: string
  endDate: string
}

interface FilterBarProps {
  value: FilterState
  onChange: (next: FilterState) => void
}

const STATUS_TABS: Array<{ key: FilterState['status']; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待复核' },
  { key: 'confirmed', label: '已复核' },
  { key: 'exception', label: '异常' },
]

export default function FilterBar({ value, onChange }: FilterBarProps) {
  const update = <K extends keyof FilterState>(key: K, next: FilterState[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
        {STATUS_TABS.map((tab) => {
          const active = value.status === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => update('status', tab.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value.keyword}
          onChange={(e) => update('keyword', e.target.value)}
          placeholder="搜索宠物名 / 主人 / 编号"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className="w-[128px] bg-transparent text-xs text-slate-700 focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-400">至</span>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className="w-[128px] bg-transparent text-xs text-slate-700 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
