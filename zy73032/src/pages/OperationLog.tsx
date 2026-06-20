import { useState } from 'react'
import { ScrollText, ChevronDown, ChevronUp, User, Clock } from 'lucide-react'
import { useReconcileStore } from '../store/useReconcileStore'
import { formatDateTimeCN } from '../utils/helpers'
import { LOG_ACTION_LABEL } from '../types'
import DiffViewer from '../components/DiffViewer'
import OnboardingSidebar from '../components/OnboardingSidebar'
import type { OperationLog } from '../types'

export default function OperationLogPage() {
  const logs = useReconcileStore((s) => s.logs)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showReviewMode, setShowReviewMode] = useState(false)

  const confirmLogs = logs.filter((l) => l.action === 'confirm' || l.action === 'withdraw')
  const latestConfirm = confirmLogs[0]

  const groupedByDate: Record<string, OperationLog[]> = {}
  for (const log of logs) {
    const date = log.operated_at.split('T')[0]
    if (!groupedByDate[date]) groupedByDate[date] = []
    groupedByDate[date].push(log)
  }
  const dates = Object.keys(groupedByDate).sort().reverse()

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="card-title text-amber-900 mb-0">
                📋 公示复盘对比
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                社区公示前在这里并排对比人工确认前后到底改了什么，变动原因不会断
              </p>
            </div>
            <button
              className={`btn ${
                showReviewMode
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-100'
              }`}
              onClick={() => setShowReviewMode(!showReviewMode)}
            >
              {showReviewMode ? '收起对比' : '打开复盘对比'}
            </button>
          </div>

          {showReviewMode && latestConfirm && (
            <div className="mt-4 bg-white rounded-xl border-2 border-amber-300 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ScrollText size={18} className="text-amber-600" />
                  <span className="font-semibold text-amber-900">
                    {LOG_ACTION_LABEL[latestConfirm.action] || latestConfirm.action}
                  </span>
                </div>
                <div className="text-sm text-warm-500 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <User size={14} /> {latestConfirm.operator}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {formatDateTimeCN(latestConfirm.operated_at)}
                  </span>
                </div>
              </div>
              {latestConfirm.remark && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4 border border-amber-200">
                  💬 <span className="font-medium">备注：</span>
                  {latestConfirm.remark}
                </p>
              )}
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-warm-600 pb-2 border-b border-warm-200">
                <div>字段</div>
                <div className="text-danger-600">📕 确认前</div>
                <div className="text-success-700">📗 确认后</div>
              </div>
              <div className="pt-2">
                <DiffViewer
                  before={latestConfirm.before_state}
                  after={latestConfirm.after_state}
                  compact
                />
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title flex items-center gap-2">
            <ScrollText size={18} className="text-brand-600" />
            操作日志时间线
          </h3>
          <p className="text-sm text-warm-500 mb-4">
            所有确认、撤回、别名绑定、导入操作都在这里留痕，谁做的、为什么改、改前改后一目了然
          </p>

          {dates.length === 0 ? (
            <p className="text-warm-400 text-sm py-4">暂无操作记录</p>
          ) : (
            <div className="space-y-6">
              {dates.map((date) => (
                <div key={date}>
                  <p className="text-sm font-medium text-warm-500 mb-3 sticky top-0 bg-white py-1 z-10">
                    {date}
                  </p>
                  <div className="relative pl-6 border-l-2 border-warm-200 space-y-3">
                    {groupedByDate[date].map((log) => (
                      <LogItem
                        key={log.id}
                        log={log}
                        expanded={expandedId === log.id}
                        onToggle={() =>
                          setExpandedId(expandedId === log.id ? null : log.id)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
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

interface LogItemProps {
  log: OperationLog
  expanded: boolean
  onToggle: () => void
}

function LogItem({ log, expanded, onToggle }: LogItemProps) {
  const actionLabel = LOG_ACTION_LABEL[log.action] || log.action

  const toneMap: Record<string, string> = {
    confirm: 'bg-success-100 text-success-700',
    withdraw: 'bg-warm-200 text-warm-700',
    bind_alias: 'bg-brand-100 text-brand-700',
    import_csv: 'bg-blue-100 text-blue-700',
    import_medical: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="relative">
      <div
        className={`absolute -left-[26px] top-2.5 w-4 h-4 rounded-full border-2 border-white ${
          log.action === 'confirm'
            ? 'bg-success-500'
            : log.action === 'withdraw'
              ? 'bg-warm-400'
              : 'bg-brand-500'
        }`}
      />
      <div
        className={`bg-white border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-shadow ${
          expanded ? 'border-brand-300 shadow-sm' : 'border-warm-200'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`tag ${toneMap[log.action] || 'bg-warm-100 text-warm-700'}`}>
              {actionLabel}
            </span>
            <span className="text-sm text-warm-700 font-medium">
              目标 #{log.target_id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-warm-500">
              {log.operator} · {formatDateTimeCN(log.operated_at).split(' ')[1]}
            </span>
            {expanded ? (
              <ChevronUp size={16} className="text-warm-400" />
            ) : (
              <ChevronDown size={16} className="text-warm-400" />
            )}
          </div>
        </div>
        {log.remark && (
          <p className="text-sm text-warm-600 mt-2 bg-warm-50 rounded-md p-2">
            💬 {log.remark}
          </p>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-warm-100">
            <p className="text-xs font-medium text-warm-500 mb-2">
              字段变化对比
            </p>
            <DiffViewer
              before={log.before_state}
              after={log.after_state}
              compact
            />
          </div>
        )}
      </div>
    </div>
  )
}
