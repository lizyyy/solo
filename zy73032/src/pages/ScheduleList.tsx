import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Check,
  Undo2,
  Search,
  CalendarDays,
  FileText,
  Clock,
} from 'lucide-react'
import { useReconcileStore } from '../store/useReconcileStore'
import {
  SCHEDULE_STATUS_LABEL,
  type Schedule,
  type ScheduleStatus,
  type OperationLog,
} from '../types'
import { formatDateCN, formatDateTimeCN } from '../utils/helpers'
import DiffViewer from '../components/DiffViewer'
import OnboardingSidebar from '../components/OnboardingSidebar'

const FILTERS: { key: ScheduleStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'withdrawn', label: '已撤回' },
  { key: 'anomaly', label: '异常' },
]

export default function ScheduleList() {
  const schedules = useReconcileStore((s) => s.schedules)
  const logs = useReconcileStore((s) => s.logs)
  const confirmSchedule = useReconcileStore((s) => s.confirmSchedule)
  const withdrawSchedule = useReconcileStore((s) => s.withdrawSchedule)
  const operator = useReconcileStore((s) => s.operator)
  const [filter, setFilter] = useState<ScheduleStatus | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filtered = schedules.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false
    if (keyword && !s.pet_name.includes(keyword) && !s.course_name.includes(keyword)) {
      return false
    }
    return true
  })

  const countByStatus = (status: ScheduleStatus) =>
    schedules.filter((s) => s.status === status).length

  const logsForSchedule = (id: number) =>
    logs.filter(
      (l) => l.target_type === 'schedule' && l.target_id === id,
    )

  const handleConfirm = async (id: number) => {
    if (schedules.find((s) => s.id === id)?.status === 'anomaly') {
      alert('异常排程需要先去「异常追踪」绑定别名，不能直接揉进正常汇总')
      return
    }
    const r = prompt('确认备注（可选）：', '')
    if (r === null) return
    try {
      await confirmSchedule(id, r)
      setExpandedId(id)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleWithdraw = async (id: number) => {
    const reason = prompt('撤回原因（可选）：', '')
    if (reason === null) return
    try {
      await withdrawSchedule(id, reason || '公示前撤回复核')
      setExpandedId(id)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="搜索宠物名 / 课程名..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`btn text-xs ${
                    filter === f.key
                      ? 'bg-brand-600 text-white'
                      : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                  }`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className="ml-1 opacity-70">
                    ({f.key === 'all' ? schedules.length : countByStatus(f.key)})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((schedule) => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              expanded={expandedId === schedule.id}
              onToggle={() =>
                setExpandedId(expandedId === schedule.id ? null : schedule.id)
              }
              onConfirm={() => handleConfirm(schedule.id)}
              onWithdraw={() => handleWithdraw(schedule.id)}
              logs={logsForSchedule(schedule.id)}
              operator={operator}
            />
          ))}
          {filtered.length === 0 && (
            <div className="card text-center py-8 text-warm-400">
              没有符合条件的排程
            </div>
          )}
        </div>
      </div>

      <div className="w-80 flex-shrink-0">
        <OnboardingSidebar />
      </div>
    </div>
  )
}

interface ScheduleRowProps {
  schedule: Schedule
  expanded: boolean
  onToggle: () => void
  onConfirm: () => void
  onWithdraw: () => void
  logs: OperationLog[]
  operator: string
}

function ScheduleRow({
  schedule,
  expanded,
  onToggle,
  onConfirm,
  onWithdraw,
  logs,
}: ScheduleRowProps) {
  const isAnomaly = schedule.status === 'anomaly'
  const isConfirmed = schedule.status === 'confirmed'
  const isWithdrawn = schedule.status === 'withdrawn'

  return (
    <div
      className={`card ${expanded ? 'ring-2 ring-brand-200' : ''} ${
        isAnomaly ? 'border-danger-200 bg-danger-50/30' : ''
      } transition-all`}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isAnomaly
                ? 'bg-danger-100 text-danger-700'
                : isConfirmed
                  ? 'bg-success-100 text-success-700'
                  : 'bg-brand-100 text-brand-700'
            }`}
          >
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="font-medium text-warm-800">
              {schedule.pet_name}
              <span className="text-warm-500 font-normal ml-2">
                · {schedule.course_name}
              </span>
            </p>
            <p className="text-xs text-warm-500 mt-0.5 flex items-center gap-2">
              <Clock size={12} />
              {formatDateCN(schedule.course_date)}
              <span className="text-warm-300">|</span>
              {schedule.duration_min} 分钟
              <span className="text-warm-300">|</span>
              {schedule.trainer}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`tag-${schedule.status} tag`}>
            {SCHEDULE_STATUS_LABEL[schedule.status]}
          </span>
          {expanded ? (
            <ChevronUp size={18} className="text-warm-400" />
          ) : (
            <ChevronDown size={18} className="text-warm-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-warm-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-warm-700 flex items-center gap-1.5">
                <FileText size={14} /> 来源与状态
              </p>
              <div className="bg-warm-50 rounded-lg p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-warm-500">来源排程ID</span>
                  <span className="text-warm-700 font-mono">{schedule.source_row}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-warm-500">来源单据ID</span>
                  <span className="text-warm-700 font-mono">#{schedule.source_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-warm-500">当前状态</span>
                  <span className={`tag-${schedule.status} tag`}>
                    {SCHEDULE_STATUS_LABEL[schedule.status]}
                  </span>
                </div>
                {schedule.anomaly_reason && (
                  <div className="pt-1.5 border-t border-warm-200 mt-1">
                    <span className="text-danger-600 text-xs">
                      ⚠️ {schedule.anomaly_reason}
                    </span>
                  </div>
                )}
                {schedule.confirmed_at && (
                  <div className="pt-1.5 border-t border-warm-200 mt-1">
                    <span className="text-success-700 text-xs">
                      ✅ {schedule.confirmed_by} 于 {formatDateTimeCN(schedule.confirmed_at)} 确认
                    </span>
                  </div>
                )}
                {schedule.withdrawn_at && (
                  <div className="pt-1.5 border-t border-warm-200 mt-1">
                    <span className="text-warm-600 text-xs">
                      ↩️ 于 {formatDateTimeCN(schedule.withdrawn_at)} 撤回
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-warm-700 flex items-center gap-1.5">
                <FileText size={14} /> 操作轨迹
              </p>
              <div className="bg-warm-50 rounded-lg p-3 text-sm max-h-48 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-warm-400 text-xs">暂无操作记录</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => {
                      const actionLabel =
                        log.action === 'confirm'
                          ? '确认排程'
                          : log.action === 'withdraw'
                            ? '撤回排程'
                            : log.action
                      return (
                        <div
                          key={log.id}
                          className="text-xs border-l-2 border-brand-300 pl-3"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-warm-700">
                              {actionLabel}
                            </span>
                            <span className="text-warm-400">
                              {formatDateTimeCN(log.operated_at)}
                            </span>
                          </div>
                          <p className="text-warm-500 mt-0.5">
                            操作人：{log.operator}
                          </p>
                          {log.remark && (
                            <p className="text-brand-600 mt-0.5">
                              备注：{log.remark}
                            </p>
                          )}
                          {(log.before_state || log.after_state) && (
                            <div className="mt-2 bg-white rounded p-2">
                              <DiffViewer
                                before={log.before_state}
                                after={log.after_state}
                                compact
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {!isConfirmed && !isWithdrawn && !isAnomaly && (
              <button className="btn-primary" onClick={onConfirm}>
                <Check size={14} /> 确认排程
              </button>
            )}
            {isConfirmed && (
              <button className="btn-secondary" onClick={onWithdraw}>
                <Undo2 size={14} /> 撤回确认
              </button>
            )}
            {isAnomaly && (
              <button
                className="btn-danger"
                onClick={() => {
                  window.location.hash = '#/anomalies'
                  window.dispatchEvent(new CustomEvent('navigate-to-anomalies'))
                }}
              >
                去异常追踪处理 →
              </button>
            )}
            {isWithdrawn && (
              <span className="text-sm text-warm-400">已撤回的排程不能再确认</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
