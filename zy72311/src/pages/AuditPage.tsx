import { useState, useEffect } from 'react'
import { Search, Filter, User, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { AuditLog } from '@/store/useStore'

const actionColors: Record<string, string> = {
  import: 'bg-blue-400',
  supplement: 'bg-amber-400',
  resolve_conflict: 'bg-emerald-400',
  update_result: 'bg-purple-400',
  review: 'bg-slate-400',
}

const actionBadgeColors: Record<string, string> = {
  import: 'bg-blue-500/10 text-blue-400',
  supplement: 'bg-amber-500/10 text-amber-400',
  resolve_conflict: 'bg-emerald-500/10 text-emerald-400',
  update_result: 'bg-purple-500/10 text-purple-400',
  review: 'bg-slate-500/10 text-slate-400',
}

const actionLabels: Record<string, string> = {
  import: '数据导入',
  supplement: '数据补录',
  resolve_conflict: '冲突解决',
  update_result: '结果更新',
  review: '数据复核',
}

export default function AuditPage() {
  const { auditLogs, fetchAuditLogs } = useStore()
  const [filters, setFilters] = useState({
    operator: '',
    action: '',
    keyword: '',
    from: '',
    to: '',
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  const handleSearch = () => {
    fetchAuditLogs({
      operator: filters.operator || undefined,
      action: filters.action || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      keyword: filters.keyword || undefined,
    })
  }

  const operators = [...new Set(auditLogs.map((l) => l.operator))]

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">审计日志</h2>
        <span className="text-xs text-slate-500">操作记录全程追溯</span>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">筛选条件</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filters.operator}
            onChange={(e) => setFilters((p) => ({ ...p, operator: e.target.value }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="">操作人</option>
            {operators.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          <select
            value={filters.action}
            onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="">操作类型</option>
            {Object.entries(actionLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
          />

          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
          />

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))}
                placeholder="关键词搜索"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <button onClick={handleSearch} className="btn-primary text-sm px-3">
              搜索
            </button>
          </div>
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <div className="card text-center py-12">
          <Clock size={32} className="mx-auto text-slate-500 mb-2" />
          <div className="text-sm text-slate-500">暂无审计日志</div>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />

          <div className="space-y-4">
            {auditLogs.map((log: AuditLog) => {
              const isExpanded = expandedId === log.id
              const hasDetails = log.beforeValue || log.afterValue || (log.affectedResults?.length > 0)

              return (
                <div key={log.id} className="relative">
                  <div
                    className={`absolute -left-5 top-4 w-3 h-3 rounded-full border-2 border-slate-800 ${
                      actionColors[log.action] || 'bg-slate-400'
                    }`}
                  />

                  <div className="card ml-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-slate-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200">{log.operator}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              actionBadgeColors[log.action] || 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            {actionLabels[log.action] || log.action}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">{log.reason}</p>

                        {hasDetails && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="mt-2 text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 transition-colors"
                          >
                            {isExpanded ? '收起详情' : '查看详情'}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}

                        {isExpanded && hasDetails && (
                          <div className="mt-3 space-y-2 border-t border-slate-700/50 pt-3">
                            {log.beforeValue && (
                              <div>
                                <div className="text-xs text-slate-500 mb-1">变更前</div>
                                <pre className="text-xs bg-slate-700/50 rounded p-2 text-slate-400 overflow-x-auto">
                                  {formatValue(log.beforeValue)}
                                </pre>
                              </div>
                            )}
                            {log.afterValue && (
                              <div>
                                <div className="text-xs text-slate-500 mb-1">变更后</div>
                                <pre className="text-xs bg-slate-700/50 rounded p-2 text-amber-400 overflow-x-auto">
                                  {formatValue(log.afterValue)}
                                </pre>
                              </div>
                            )}
                            {log.affectedResults?.length > 0 && (
                              <div>
                                <div className="text-xs text-slate-500 mb-1">影响的记录</div>
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

                      <div className="text-xs text-slate-600 flex-shrink-0">
                        {new Date(log.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
