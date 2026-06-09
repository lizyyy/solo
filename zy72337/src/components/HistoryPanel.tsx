import { useEffect } from 'react'
import { X, Clock, User, ArrowRight, FileText } from 'lucide-react'
import { useAppStore } from '@/store'
import type { AuditLog } from '@/store'

interface HistoryPanelProps {
  paramItemId?: string
  counterexampleId?: string
  onClose?: () => void
}

const actionTypeLabels: Record<string, string> = {
  import: '导入',
  create_counterexample: '创建反例',
  conflict_adjudication: '冲突裁定',
  adjudicate_conflict: '冲突裁定',
  denominator_zero_review: '分母为零复核',
  review_denominator_zero: '分母为零复核',
  recalculate: '重新计算',
  workflow_advance: '推进工作流',
  self_check: '运行自检',
  update_value: '更新值',
  checks: '质量检查',
}

export default function HistoryPanel({ paramItemId, counterexampleId, onClose }: HistoryPanelProps) {
  const { auditLogs, fetchAuditLogs, loading } = useAppStore()

  useEffect(() => {
    fetchAuditLogs(paramItemId, counterexampleId)
  }, [fetchAuditLogs, paramItemId, counterexampleId])

  const sortedLogs = [...auditLogs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[480px] bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-400" />
            <h3 className="text-lg font-bold">操作历史记录</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && sortedLogs.length === 0 ? (
            <div className="text-center text-slate-400 py-10">加载中...</div>
          ) : sortedLogs.length === 0 ? (
            <div className="text-center py-10">
              <FileText size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500 text-sm">暂无操作历史记录</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-700" />
              <ul className="space-y-4">
                {sortedLogs.map((log: AuditLog, idx: number) => (
                  <li key={log.id} className="relative pl-10">
                    <div className={`absolute left-2 top-1.5 w-4 h-4 rounded-full border-2 border-slate-700 ${
                      idx === 0 ? 'bg-amber-400 border-amber-400' : 'bg-slate-800'
                    }`} />
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            log.actionType === 'adjudicate_conflict' || log.actionType === 'review_denominator_zero'
                              ? 'bg-amber-500/20 text-amber-400'
                              : log.actionType === 'import' || log.actionType === 'create_counterexample'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : log.actionType === 'workflow_advance' || log.actionType === 'recalculate'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {actionTypeLabels[log.actionType] || log.actionType}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {(log.previousValue || log.newValue) && (
                        <div className="flex items-center gap-2 mb-2 text-sm font-mono bg-slate-800/50 rounded px-2 py-1.5">
                          {log.previousValue && (
                            <span className="text-slate-500 line-through max-w-[120px] truncate">{log.previousValue}</span>
                          )}
                          {log.previousValue && log.newValue && (
                            <ArrowRight size={12} className="text-slate-600 flex-shrink-0" />
                          )}
                          {log.newValue && (
                            <span className="text-amber-400 max-w-[120px] truncate">{log.newValue}</span>
                          )}
                        </div>
                      )}

                      {(log.reason || log.note) && (
                        <div className="text-xs text-slate-400 mb-2">
                          {log.reason && (
                            <div className="mb-1">
                              <span className="text-slate-500">理由:</span>
                              <span className="ml-1 text-slate-300">{log.reason}</span>
                            </div>
                          )}
                          {log.note && (
                            <div>
                              <span className="text-slate-500">备注:</span>
                              <span className="ml-1 text-slate-300">{log.note}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          <span>{log.actor || '系统'}</span>
                        </div>
                        {log.nextAction && (
                          <span className="text-sky-400">→ {log.nextAction}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
