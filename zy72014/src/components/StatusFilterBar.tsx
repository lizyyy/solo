import type { StatusFilter } from '@shared/types'

const STATUS_LABELS: Record<string, string> = {
  all: '全部',
  matched: '已匹配',
  needs_review: '需确认',
  overridden: '已改判',
  rolled_back: '已回退',
}

const STATUS_COLORS: Record<string, string> = {
  matched: 'bg-emerald-100 text-emerald-800',
  needs_review: 'bg-amber-100 text-amber-800',
  overridden: 'bg-sky-100 text-sky-800',
  rolled_back: 'bg-orange-100 text-orange-800',
}

interface StatusFilterBarProps {
  current: StatusFilter
  onChange: (filter: StatusFilter) => void
}

export default function StatusFilterBar({ current, onChange }: StatusFilterBarProps) {
  const filters: StatusFilter[] = ['all', 'matched', 'needs_review', 'overridden', 'rolled_back']

  return (
    <div className="flex gap-1 border-b border-stone-200">
      {filters.map(f => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            current === f
              ? 'bg-[#1e3a5f] text-white'
              : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
          }`}
        >
          {STATUS_LABELS[f]}
        </button>
      ))}
    </div>
  )
}

export { STATUS_LABELS, STATUS_COLORS }
