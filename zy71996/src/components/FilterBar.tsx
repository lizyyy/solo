import type { FilterType } from '@/types'
import { useInspectionStore } from '@/store/inspectionStore'

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'supplement', label: '仅补材料' },
  { key: 'conclusion_changed', label: '仅改结论' },
  { key: 'confirmed', label: '已确认' },
]

export default function FilterBar() {
  const filter = useInspectionStore((s) => s.filter)
  const setFilter = useInspectionStore((s) => s.setFilter)

  return (
    <div className="flex items-center gap-2">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === key
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
