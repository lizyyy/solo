import { useMemo } from 'react'
import { Pencil } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { TaskOrder } from '../../utils/types'

const TYPE_LABELS: Record<string, string> = {
  pick: '拣选',
  place: '放置',
  transfer: '搬运',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: '#00f0ff' },
  supplementary: { label: '补录', color: '#a855f7' },
  withdrawn: { label: '撤回', color: '#6b7280' },
  duplicate: { label: '重复', color: '#f59e0b' },
}

export default function TaskTable() {
  const tasks = useStore((s) => s.tasks)
  const filterState = useStore((s) => s.filterState)
  const setSelectedTrajectoryId = useStore((s) => s.setSelectedTrajectoryId)
  const selectedTrajectoryId = useStore((s) => s.selectedTrajectoryId)

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (!filterState.statusFilter.includes(t.status)) return false
        if (filterState.robotIds.length > 0 && !filterState.robotIds.includes(t.robotId))
          return false
        return true
      }),
    [tasks, filterState],
  )

  const globalStart = useMemo(() => {
    if (filtered.length === 0) return 0
    return Math.min(...filtered.map((t) => t.startTime))
  }, [filtered])

  const formatRelative = (time: number) => {
    const diff = Math.round((time - globalStart) / 1000)
    return `+${diff}s`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="py-2 px-2 text-left font-medium">任务ID</th>
            <th className="py-2 px-2 text-left font-medium">机器人</th>
            <th className="py-2 px-2 text-left font-medium">类型</th>
            <th className="py-2 px-2 text-left font-medium">开始时间</th>
            <th className="py-2 px-2 text-left font-medium">结束时间</th>
            <th className="py-2 px-2 text-left font-medium">状态</th>
            <th className="py-2 px-2 text-left font-medium">备注</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              globalStart={globalStart}
              isSelected={task.robotId === selectedTrajectoryId}
              onSelect={() => setSelectedTrajectoryId(task.robotId)}
              formatRelative={formatRelative}
            />
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-gray-500">
                暂无任务数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function TaskRow({
  task,
  isSelected,
  onSelect,
  formatRelative,
}: {
  task: TaskOrder
  globalStart: number
  isSelected: boolean
  onSelect: () => void
  formatRelative: (t: number) => string
}) {
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.normal
  const hasMissing = task.missingFields && task.missingFields.length > 0

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-gray-800 transition-colors hover:bg-white/5 ${
        isSelected ? 'bg-[#00f0ff]/10' : ''
      }`}
      style={hasMissing ? { backgroundColor: '#422006' } : undefined}
    >
      <td className="py-2 px-2 text-gray-300 font-mono">{task.id}</td>
      <td className="py-2 px-2 text-gray-300">{task.robotId}</td>
      <td className="py-2 px-2 text-gray-300">{TYPE_LABELS[task.type] ?? task.type}</td>
      <td className="py-2 px-2 text-gray-300">{formatRelative(task.startTime)}</td>
      <td className="py-2 px-2">
        {task.endTime != null ? (
          <span className="text-gray-300">{formatRelative(task.endTime)}</span>
        ) : (
          <span className="text-red-400">缺失</span>
        )}
      </td>
      <td className="py-2 px-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${statusCfg.color}22`,
            color: statusCfg.color,
          }}
        >
          {statusCfg.label}
        </span>
      </td>
      <td className="py-2 px-2">
        {task.noteHistory && task.noteHistory.length > 0 ? (
          <span className="group relative inline-flex items-center">
            <Pencil className="h-3 w-3 text-gray-400" />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden rounded bg-gray-800 px-2 py-1 text-[10px] text-gray-200 whitespace-nowrap group-hover:block z-10">
              {task.note ?? '有修改记录'}
            </span>
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
    </tr>
  )
}
