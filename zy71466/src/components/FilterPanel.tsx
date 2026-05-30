import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, X, RotateCcw, Filter } from 'lucide-react'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import type { FilterState } from '@/types'
import { cn } from '@/lib/utils'

interface FilterConfig {
  key: keyof FilterState
  label: string
  options: string[]
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-150',
          selected.length > 0
            ? 'border-sky/40 bg-sky/10 text-sky'
            : 'border-cold/25 bg-steel/40 text-cold/80 hover:border-cold/40 hover:text-white/80'
        )}
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky/20 px-1.5 font-mono text-xs font-medium text-sky">
            {selected.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            'ml-auto transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-cold/20 bg-steel p-1.5 shadow-xl shadow-black/30">
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-cold/50">暂无数据</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/5"
                  onClick={() => onToggle(opt)}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors duration-150',
                      selected.includes(opt)
                        ? 'border-sky bg-sky'
                        : 'border-cold/40 bg-transparent'
                    )}
                  >
                    {selected.includes(opt) && (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </span>
                  <span className={selected.includes(opt) ? 'text-sky' : ''}>
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="mt-1 border-t border-cold/15 pt-1">
              <button
                onClick={onClear}
                className="w-full rounded-md px-3 py-1.5 text-left text-xs text-cold/60 transition-colors hover:bg-white/5 hover:text-warn"
              >
                清除选择
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FilterPanel() {
  const { curves, filteredCurves, filterState, setFilterState, applyFilter, reset } =
    useAnalysisStore()

  const filters: FilterConfig[] = useMemo(() => {
    const batchSet = new Set(curves.map((c) => c.batchNo))
    const deviceSet = new Set(curves.map((c) => c.deviceId))
    const fractureSet = new Set(
      curves.filter((c) => c.fractureType).map((c) => c.fractureType!)
    )

    return [
      { key: 'selectedBatches', label: '批次', options: Array.from(batchSet).sort() },
      { key: 'selectedDevices', label: '设备编号', options: Array.from(deviceSet).sort() },
      { key: 'selectedAnomalyTypes', label: '异常类型', options: ['正常', '异常'] },
      {
        key: 'selectedFractureTypes',
        label: '断裂形态',
        options: Array.from(fractureSet).sort(),
      },
    ]
  }, [curves])

  const handleToggle = useCallback(
    (key: keyof FilterState, value: string) => {
      const current = filterState[key] as string[]
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const newFilter = { ...filterState, [key]: next }
      setFilterState(newFilter)
      applyFilter()
    },
    [filterState, setFilterState, applyFilter]
  )

  const handleClearFilter = useCallback(
    (key: keyof FilterState) => {
      const newFilter = { ...filterState, [key]: [] }
      setFilterState(newFilter)
      applyFilter()
    },
    [filterState, setFilterState, applyFilter]
  )

  const handleRemoveTag = useCallback(
    (key: keyof FilterState, value: string) => {
      const current = filterState[key] as string[]
      const next = current.filter((v) => v !== value)
      const newFilter = { ...filterState, [key]: next }
      setFilterState(newFilter)
      applyFilter()
    },
    [filterState, setFilterState, applyFilter]
  )

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  const hasActiveFilters = Object.values(filterState).some((v) => v.length > 0)

  const allTags = useMemo(() => {
    const tags: { key: keyof FilterState; value: string; label: string }[] = []
    ;(Object.entries(filterState) as [keyof FilterState, string[]][]).forEach(
      ([key, values]) => {
        const filterCfg = filters.find((f) => f.key === key)
        if (!filterCfg) return
        values.forEach((v) =>
          tags.push({ key, value: v, label: `${filterCfg.label}: ${v}` })
        )
      }
    )
    return tags
  }, [filterState, filters])

  return (
    <div className="rounded-xl border border-cold/15 bg-steel/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-sky" />
          <h2 className="text-sm font-medium text-white/90">数据筛选</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-cold/60">
            结果: <span className="text-sky">{filteredCurves.length}</span> / {curves.length}
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-cold/60 transition-colors hover:bg-warn/10 hover:text-warn"
            >
              <RotateCcw size={12} />
              重置筛选
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {filters.map((f) => (
          <FilterDropdown
            key={f.key}
            label={f.label}
            options={f.options}
            selected={filterState[f.key] as string[]}
            onToggle={(v) => handleToggle(f.key, v)}
            onClear={() => handleClearFilter(f.key)}
          />
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-cold/10 pt-3.5">
          {allTags.map((tag) => (
            <span
              key={`${tag.key}-${tag.value}`}
              className="flex items-center gap-1 rounded-md bg-sky/10 px-2 py-0.5 text-xs text-sky transition-colors hover:bg-sky/20"
            >
              {tag.label}
              <button
                onClick={() => handleRemoveTag(tag.key, tag.value)}
                className="ml-0.5 rounded-sm p-0.5 transition-colors hover:bg-sky/20 hover:text-white"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
