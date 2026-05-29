import { useStore } from '../store'
import { RotateCcw } from 'lucide-react'
import { INSTRUMENTS, NOISE_LEVELS } from '../../shared/types'

export default function FilterBar() {
  const { filters, setFilters, rooms, fetchReservations } = useStore()

  const handleReset = () => {
    setFilters({ room: '', instrument: '', person: '', dateFrom: '', dateTo: '', noiseLevel: '' })
    setTimeout(() => fetchReservations(), 0)
  }

  const handleChange = (key: string, value: string) => {
    setFilters({ [key]: value })
  }

  const handleApply = () => {
    fetchReservations()
  }

  const selectCls = 'bg-brand-800 border border-brand-600 text-brand-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-amber-400'
  const inputCls = 'bg-brand-800 border border-brand-600 text-brand-100 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-amber-400'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectCls} value={filters.room} onChange={(e) => handleChange('room', e.target.value)}>
        <option value="">全部琴房</option>
        {rooms.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
      </select>

      <select className={selectCls} value={filters.instrument} onChange={(e) => handleChange('instrument', e.target.value)}>
        <option value="">全部乐器</option>
        {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
      </select>

      <input
        type="text"
        placeholder="预约人"
        className={`${inputCls} w-24`}
        value={filters.person}
        onChange={(e) => handleChange('person', e.target.value)}
      />

      <select className={selectCls} value={filters.noiseLevel} onChange={(e) => handleChange('noiseLevel', e.target.value)}>
        <option value="">全部噪声</option>
        {NOISE_LEVELS.map((n) => <option key={n.value} value={String(n.value)}>{n.label}</option>)}
      </select>

      <input
        type="date"
        className={inputCls}
        value={filters.dateFrom}
        onChange={(e) => handleChange('dateFrom', e.target.value)}
      />
      <span className="text-brand-400 text-xs">至</span>
      <input
        type="date"
        className={inputCls}
        value={filters.dateTo}
        onChange={(e) => handleChange('dateTo', e.target.value)}
      />

      <button
        onClick={handleApply}
        className="bg-amber-500 hover:bg-amber-600 text-brand-900 text-xs font-medium rounded px-3 py-1.5 transition-colors"
      >
        筛选
      </button>
      <button
        onClick={handleReset}
        className="flex items-center gap-1 text-brand-400 hover:text-white text-xs transition-colors"
      >
        <RotateCcw size={12} />
        重置
      </button>
    </div>
  )
}
