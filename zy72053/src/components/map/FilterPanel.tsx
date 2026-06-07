import { useStore } from '@/store/useStore'
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from '@/types'
import type { Severity, Source, PointStatus } from '@/types'
import { X, RotateCcw } from 'lucide-react'
import FilterPresetBar from './FilterPresetBar'

interface FilterPanelProps {
  open: boolean
  onClose: () => void
}

const severityLevels: Severity[] = ['none', 'minor', 'moderate', 'severe', 'critical']
const sourceKeys: Source[] = ['gis', 'inspection', 'excel']
const statusKeys: PointStatus[] = ['normal', 'anomaly', 'exception']

export default function FilterPanel({ open, onClose }: FilterPanelProps) {
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const resetFilters = useStore((s) => s.resetFilters)
  const pipes = useStore((s) => s.pipes)

  function toggleSeverity(s: Severity) {
    const next = filters.severity.includes(s)
      ? filters.severity.filter((v) => v !== s)
      : [...filters.severity, s]
    setFilters({ severity: next })
  }

  function toggleSource(s: Source) {
    const next = filters.sources.includes(s)
      ? filters.sources.filter((v) => v !== s)
      : [...filters.sources, s]
    setFilters({ sources: next })
  }

  function toggleStatus(s: PointStatus) {
    const next = filters.status.includes(s)
      ? filters.status.filter((v) => v !== s)
      : [...filters.status, s]
    setFilters({ status: next })
  }

  function togglePipe(id: string) {
    const next = filters.pipeIds.includes(id)
      ? filters.pipeIds.filter((v) => v !== id)
      : [...filters.pipeIds, id]
    setFilters({ pipeIds: next })
  }

  return (
    <div
      className={`absolute left-0 top-0 z-30 h-full w-72 transform overflow-y-auto bg-black/70 backdrop-blur-md transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-cyan-400">筛选条件</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-white/10 px-4 py-3">
        <FilterPresetBar />
      </div>

      <div className="space-y-5 px-4 py-4">
        <section>
          <h3 className="mb-2 text-xs font-medium text-gray-400">腐蚀等级</h3>
          <div className="flex flex-wrap gap-2">
            {severityLevels.map((s) => {
              const active = filters.severity.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleSeverity(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active ? 'text-white ring-1 ring-white/30' : 'text-gray-400 opacity-60'
                  }`}
                  style={{
                    backgroundColor: active ? SEVERITY_COLORS[s] + '33' : 'transparent',
                    borderColor: SEVERITY_COLORS[s],
                    ...(active ? { boxShadow: `0 0 6px ${SEVERITY_COLORS[s]}44` } : {}),
                  }}
                >
                  {SEVERITY_LABELS[s]}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium text-gray-400">数据来源</h3>
          <div className="space-y-2">
            {sourceKeys.map((s) => {
              const active = filters.sources.includes(s)
              return (
                <label key={s} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleSource(s)}
                    className="h-4 w-4 rounded border-gray-600 bg-transparent accent-cyan-500"
                  />
                  <span className={`text-sm ${active ? 'text-cyan-400' : 'text-gray-400'}`}>
                    {SOURCE_LABELS[s]}
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium text-gray-400">状态</h3>
          <div className="flex flex-wrap gap-2">
            {statusKeys.map((s) => {
              const active = filters.status.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                      : 'border-gray-600 text-gray-400 opacity-60'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium text-gray-400">管线</h3>
          <div className="space-y-2">
            {pipes.map((p) => {
              const active = filters.pipeIds.includes(p.id)
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => togglePipe(p.id)}
                    className="h-4 w-4 rounded border-gray-600 bg-transparent accent-cyan-500"
                  />
                  <span className={`text-sm ${active ? 'text-cyan-400' : 'text-gray-400'}`}>
                    {p.name}
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <button
          onClick={resetFilters}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-600 bg-transparent py-2 text-sm text-gray-400 transition-colors hover:border-cyan-500 hover:text-cyan-400"
        >
          <RotateCcw size={14} />
          重置筛选
        </button>
      </div>
    </div>
  )
}
