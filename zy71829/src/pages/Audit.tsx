import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScrollText, Search, RefreshCw, ExternalLink } from 'lucide-react'
import { useQueueStore } from '@/store'
import type { ActionType } from '@shared/types'

const ACTION_STYLES: Record<ActionType, { bg: string; text: string }> = {
  '创建': { bg: 'bg-green-900/50', text: 'text-green-400' },
  '状态变更': { bg: 'bg-blue-900/50', text: 'text-blue-400' },
  '人工确认': { bg: 'bg-emerald-900/50', text: 'text-emerald-400' },
  '驳回': { bg: 'bg-red-900/50', text: 'text-red-400' },
  '关联': { bg: 'bg-purple-900/50', text: 'text-purple-400' },
  '重复标记': { bg: 'bg-orange-900/50', text: 'text-orange-400' },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function Audit() {
  const navigate = useNavigate()
  const { auditLogs, fetchAuditLogs, loading } = useQueueStore()

  const [operatorFilter, setOperatorFilter] = useState('')
  const [recordIdFilter, setRecordIdFilter] = useState('')

  const loadLogs = useCallback(() => {
    const filters: { operator?: string; recordId?: string } = {}
    if (operatorFilter.trim()) filters.operator = operatorFilter.trim()
    if (recordIdFilter.trim()) filters.recordId = recordIdFilter.trim()
    fetchAuditLogs(filters)
  }, [operatorFilter, recordIdFilter, fetchAuditLogs])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadLogs()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="w-6 h-6 text-port-orange" />
        <h2 className="text-xl font-bold text-port-text">操作审计</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-port-muted" />
          <input
            type="text"
            placeholder="操作人..."
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 bg-port-surface border border-port-border rounded-lg text-port-text placeholder:text-port-muted focus:outline-none focus:border-port-orange transition-colors"
          />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-port-muted" />
          <input
            type="text"
            placeholder="记录ID..."
            value={recordIdFilter}
            onChange={(e) => setRecordIdFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 bg-port-surface border border-port-border rounded-lg text-port-text placeholder:text-port-muted focus:outline-none focus:border-port-orange transition-colors"
          />
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-port-orange text-white rounded-lg hover:bg-port-orange-light transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="bg-port-card border border-port-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-port-surface">
              <th className="text-left px-5 py-3 text-sm font-medium text-port-muted">时间</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-port-muted">操作类型</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-port-muted">操作人</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-port-muted">目标记录</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-port-muted">详情</th>
            </tr>
          </thead>
          <tbody>
            {loading && auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-port-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-port-muted">
                  暂无审计日志
                </td>
              </tr>
            ) : (
              auditLogs.map((log, idx) => {
                const style = ACTION_STYLES[log.action]
                return (
                  <tr
                    key={log.id}
                    className={`border-t border-port-border hover:bg-port-hover transition-colors ${idx % 2 === 0 ? 'bg-port-card' : 'bg-port-surface/30'}`}
                  >
                    <td className="px-5 py-3 text-sm text-port-muted whitespace-nowrap">
                      {formatTime(log.operatedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-port-text">{log.operator}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/record/${log.recordId}`)}
                        className="inline-flex items-center gap-1 text-sm text-port-orange hover:text-port-orange-light transition-colors"
                      >
                        {log.recordId}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-sm text-port-text max-w-md truncate" title={log.detail}>
                      {log.detail}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
