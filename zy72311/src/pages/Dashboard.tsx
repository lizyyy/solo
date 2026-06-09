import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCheck, AlertTriangle, ClipboardCheck, Clock, ArrowRight, ChevronDown, ChevronUp, User } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { AuditLog } from '@/store/useStore'

const actionColors: Record<string, string> = {
  import: 'bg-blue-400',
  supplement: 'bg-amber-400',
  resolve_conflict: 'bg-emerald-400',
  update_result: 'bg-purple-400',
  review: 'bg-slate-400',
}

const actionLabels: Record<string, string> = {
  import: '数据导入',
  supplement: '数据补录',
  resolve_conflict: '冲突解决',
  update_result: '结果更新',
  review: '数据复核',
}

const targetTypeRoutes: Record<string, string> = {
  questionnaire: '/import',
  boundary_note: '/boundary',
  conflict: '/conflicts',
  scoring_result: '/demo',
}

const targetTypeLabels: Record<string, string> = {
  questionnaire: '问卷记录',
  boundary_note: '边界值说明',
  conflict: '冲突记录',
  scoring_result: '评分结果',
}

export default function Dashboard() {
  const { questionnaireSummary, questionnaireRecords, conflicts, reviewTasks, auditLogs, fetchDashboard } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
  const pendingReviews = reviewTasks.filter((t) => t.status === 'pending')
  const boundaryLinkedCount = questionnaireRecords.filter((r) => r.boundaryNoteId).length

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">工作台</h2>
        <span className="text-xs text-slate-500">数据总览与快速入口</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileCheck size={20} className="text-amber-500" />
            </div>
            <span className="text-sm text-slate-400">导入状态</span>
          </div>
          <div className="text-3xl font-bold text-amber-500 mb-1">{questionnaireSummary.total}</div>
          <div className="text-xs text-slate-500">
            正常 <span className="text-emerald-400">{questionnaireSummary.normal}</span> ·
            分母为0 <span className="text-rose-400">{questionnaireSummary.zeroDenominator}</span> ·
            已补录 <span className="text-amber-400">{questionnaireSummary.supplemented}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            关联边界值说明 <span className="text-amber-400">{boundaryLinkedCount}</span> 条
          </div>
          <Link
            to="/import"
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
          >
            查看详情 <ArrowRight size={12} />
          </Link>
        </div>

        <div className="card border-rose-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-rose-500" />
            </div>
            <span className="text-sm text-slate-400">冲突队列</span>
          </div>
          <div className="text-3xl font-bold text-rose-500 mb-1">{pendingConflicts.length}</div>
          <div className="text-xs text-slate-500">待处理冲突数</div>
          <Link
            to="/conflicts"
            className="mt-3 text-xs text-rose-400 hover:text-rose-300 inline-flex items-center gap-1 transition-colors"
          >
            去处理 <ArrowRight size={12} />
          </Link>
        </div>

        <div className="card border-amber-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ClipboardCheck size={20} className="text-amber-500" />
            </div>
            <span className="text-sm text-slate-400">待复核</span>
          </div>
          <div className="text-3xl font-bold text-amber-500 mb-1">{pendingReviews.length}</div>
          <div className="text-xs text-slate-500">复核任务待办</div>
          <Link
            to="/review"
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
          >
            查看任务 <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-slate-400" />
          <h3 className="text-sm font-medium text-slate-300">近期审计日志</h3>
        </div>
        {auditLogs.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">暂无审计日志</div>
        ) : (
          <div className="space-y-3">
            {auditLogs.slice(0, 8).map((log: AuditLog) => {
              const isExpanded = expandedId === log.id
              const hasDetails = log.beforeValue || log.afterValue || (log.affectedResults?.length > 0)
              const targetRoute = targetTypeRoutes[log.targetType]
              const targetLabel = targetTypeLabels[log.targetType] || log.targetType
              return (
                <div key={log.id} className="rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors overflow-hidden">
                  <div className="flex items-center gap-3 py-2 px-3">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        actionColors[log.action] || 'bg-slate-400'
                      }`}
                    />
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400 flex-shrink-0">
                      {actionLabels[log.action] || log.action}
                    </span>
                    <span className="text-sm text-slate-300 flex-1 truncate">{log.reason}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{log.operator}</span>
                    <span className="text-xs text-slate-600 flex-shrink-0">
                      {new Date(log.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {hasDetails && (
                    <div className="px-3 pb-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? '收起详情' : '查看详情'}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 space-y-2 border-t border-slate-600/50 pt-2 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 flex-shrink-0 w-16">目标类型：</span>
                            <div>
                              <span className="text-slate-400">{targetLabel}</span>
                              {targetRoute && (
                                <Link to={targetRoute} className="text-amber-400 hover:text-amber-300 ml-2 underline underline-offset-2">
                                  跳转 →
                                </Link>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-slate-500 flex-shrink-0 w-16">目标ID：</span>
                            <div>
                              <span className="text-slate-400 font-mono">#{log.targetId.slice(0, 12)}</span>
                              {targetRoute && (
                                <Link to={targetRoute} className="text-amber-400 hover:text-amber-300 ml-2 underline underline-offset-2">
                                  跳转 →
                                </Link>
                              )}
                            </div>
                          </div>
                          {log.beforeValue && (
                            <div>
                              <div className="text-slate-500 mb-1">变更前：</div>
                              <pre className="text-xs bg-slate-800 rounded p-2 text-slate-400 overflow-x-auto">
                                {formatValue(log.beforeValue)}
                              </pre>
                            </div>
                          )}
                          {log.afterValue && (
                            <div>
                              <div className="text-slate-500 mb-1">变更后：</div>
                              <pre className="text-xs bg-slate-800 rounded p-2 text-amber-400 overflow-x-auto">
                                {formatValue(log.afterValue)}
                              </pre>
                            </div>
                          )}
                          {log.affectedResults?.length > 0 && (
                            <div>
                              <div className="text-slate-500 mb-1">影响的记录：</div>
                              <div className="flex flex-wrap gap-1">
                                {log.affectedResults.map((id) => (
                                  <span
                                    key={id}
                                    className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-500"
                                  >
                                    #{id.slice(0, 8)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
