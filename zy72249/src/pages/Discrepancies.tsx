import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Shield, CircleDot, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConflictPanel from '@/components/ConflictPanel'
import { useStore } from '@/store'
import type { Discrepancy } from '@/lib/api'

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  normal: { label: '正常', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  pending_review: { label: '拆行待复核', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  old_caliber: { label: '旧口径补录', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  conflict_pending: { label: '冲突待裁决', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  open: { label: '待处理', dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600' },
  resolved: { label: '已解决', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  conflict: { label: '冲突', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
}

const typeLabels: Record<string, string> = {
  split_records: '拆行记录',
  old_caliber: '旧口径',
  conflict: '冲突',
  data_mismatch: '数据不一致',
}

const severityConfig: Record<string, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertCircle, color: 'text-amber-500' },
  critical: { icon: Shield, color: 'text-red-500' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.open
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function SplitDetail({ discrepancy }: { discrepancy: Discrepancy }) {
  const evidence = discrepancy.evidence
  if (!evidence?.confirmationData) return null
  const data = evidence.confirmationData as Record<string, unknown>
  const lines = (data.lines || []) as Array<Record<string, unknown>>

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-700">
        <CircleDot className="h-3.5 w-3.5" />
        拆行明细 — 待结算主管复核
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-amber-200 text-gray-500">
            <th className="py-1 text-left font-medium">类型</th>
            <th className="py-1 text-right font-medium">金额</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-amber-100 last:border-0">
              <td className="py-1 text-gray-700">{line.type === 'fee' ? '手续费' : line.type === 'principal' ? '本金' : '-'}</td>
              <td className="py-1 text-right font-mono text-gray-900">{Number(line.amount).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Discrepancies() {
  const { discrepancies, fetchDiscrepancies, selectedDiscrepancy, setSelectedDiscrepancy } = useStore()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const filters: Record<string, string> = {}
    if (filterStatus) filters.status = filterStatus
    if (filterType) filters.type = filterType
    fetchDiscrepancies(filters)
  }, [filterStatus, filterType, fetchDiscrepancies])

  const handleRowClick = (d: Discrepancy) => {
    setExpandedId(prev => prev === d.id ? null : d.id)
  }

  const handleConflictClick = (d: Discrepancy) => {
    setSelectedDiscrepancy(d)
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      <h2 className="mb-6 text-xl font-bold text-gray-900">差异清单</h2>

      <div className="mb-4 flex items-center gap-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
        >
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="conflict_pending">冲突待裁决</option>
          <option value="resolved">已解决</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
        >
          <option value="">全部类型</option>
          <option value="split_records">拆行记录</option>
          <option value="old_caliber">旧口径</option>
          <option value="conflict">冲突</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">业务号</th>
              <th className="px-4 py-3 text-left font-medium">类型</th>
              <th className="px-4 py-3 text-left font-medium">严重程度</th>
              <th className="px-4 py-3 text-left font-medium">描述</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {discrepancies.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">暂无差异记录</td></tr>
            ) : (
              discrepancies.map(d => {
                const isExpanded = expandedId === d.id
                const sevCfg = severityConfig[d.severity] || severityConfig.info
                const SevIcon = sevCfg.icon
                return (
                  <tr key={d.id} className="group border-b last:border-0 hover:bg-gray-50/50">
                    <td colSpan={6} className="p-0">
                      <div
                        className="flex cursor-pointer items-center"
                        onClick={() => handleRowClick(d)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="px-4 py-3 font-mono text-sm text-gray-900">{d.business_no}</span>
                            <span className="px-4 py-3 text-sm text-gray-600">{typeLabels[d.type] || d.type}</span>
                            <span className="px-4 py-3 flex items-center gap-1 text-sm">
                              <SevIcon className={cn('h-4 w-4', sevCfg.color)} />
                              <span className={sevCfg.color}>{d.severity === 'critical' ? '严重' : d.severity === 'warning' ? '警告' : '提示'}</span>
                            </span>
                            <span className="flex-1 px-4 py-3 text-sm text-gray-600 truncate">{d.description}</span>
                            <span className="px-4 py-3"><StatusBadge status={d.status} /></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-3">
                          {d.status === 'conflict_pending' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleConflictClick(d) }}
                              className="rounded bg-[var(--color-amber)] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                            >
                              裁决
                            </button>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t bg-gray-50/50 px-4 py-3">
                          <div className="text-xs text-gray-500 mb-2">
                            创建时间：{new Date(d.created_at).toLocaleString('zh-CN')}
                            {d.updated_at !== d.created_at && ` · 更新时间：${new Date(d.updated_at).toLocaleString('zh-CN')}`}
                          </div>
                          {d.type === 'split_records' && <SplitDetail discrepancy={d} />}
                          {d.type === 'conflict' && d.evidence && (
                            <div className="rounded border border-red-200 bg-red-50/50 p-3 text-xs text-red-700">
                              冲突证据：除权日截图与税费率备注数据不一致，需人工裁决
                            </div>
                          )}
                          {d.resolution && (
                            <div className="mt-2 rounded border border-green-200 bg-green-50/50 p-3 text-xs text-green-700">
                              裁决结果：{d.resolution.decision === 'confirm_screenshot' ? '确认截图数据' : d.resolution.decision === 'confirm_remark' ? '确认备注数据' : '驳回两者'}
                              {d.resolution.reason && ` — ${d.resolution.reason}`}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedDiscrepancy && (
        <ConflictPanel
          discrepancy={selectedDiscrepancy}
          onClose={() => setSelectedDiscrepancy(null)}
        />
      )}
    </div>
  )
}
