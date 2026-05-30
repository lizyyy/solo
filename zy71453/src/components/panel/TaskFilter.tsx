import { useMemo } from 'react'
import { useStore } from '../../store/useStore'

const STATUS_OPTIONS = [
  { key: 'normal' as const, label: '正常', color: '#00f0ff' },
  { key: 'supplementary' as const, label: '补录', color: '#a855f7' },
  { key: 'withdrawn' as const, label: '撤回', color: '#6b7280' },
  { key: 'duplicate' as const, label: '重复', color: '#f59e0b' },
]

export default function TaskFilter() {
  const filterState = useStore((s) => s.filterState)
  const setFilterState = useStore((s) => s.setFilterState)
  const trajectories = useStore((s) => s.trajectories)

  const robotIds = useMemo(() => {
    const ids = new Set(trajectories.map((t) => t.robotId))
    return Array.from(ids).sort()
  }, [trajectories])

  const toggleStatus = (key: typeof STATUS_OPTIONS[number]['key']) => {
    const current = filterState.statusFilter
    const next = current.includes(key)
      ? current.filter((s) => s !== key)
      : [...current, key]
    setFilterState({ statusFilter: next })
  }

  const toggleRobotId = (id: string) => {
    const current = filterState.robotIds
    const next = current.includes(id)
      ? current.filter((r) => r !== id)
      : [...current, id]
    setFilterState({ robotIds: next })
  }

  const activeCount =
    (4 - filterState.statusFilter.length) + filterState.robotIds.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">状态筛选</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-[#00f0ff]/20 px-2 py-0.5 text-xs text-[#00f0ff]">
            {activeCount} 个筛选
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => {
          const active = filterState.statusFilter.includes(opt.key)
          return (
            <button
              key={opt.key}
              onClick={() => toggleStatus(opt.key)}
              className="rounded px-3 py-1 text-xs font-medium transition-all"
              style={
                active
                  ? { backgroundColor: opt.color, color: '#0a0e1a' }
                  : {
                      border: `1px solid ${opt.color}`,
                      color: opt.color,
                      background: 'transparent',
                    }
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <span className="text-sm text-gray-400">机器人ID</span>
        <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
          {robotIds.map((id) => (
            <label
              key={id}
              className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={filterState.robotIds.includes(id)}
                onChange={() => toggleRobotId(id)}
                className="accent-[#00f0ff] h-3.5 w-3.5"
              />
              <span className="text-xs text-gray-300">{id}</span>
            </label>
          ))}
          {robotIds.length === 0 && (
            <span className="text-xs text-gray-500">暂无数据</span>
          )}
        </div>
      </div>
    </div>
  )
}
