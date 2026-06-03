import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { DifferenceItem, AuditLog } from '@/types'
import { Filter, Search, Check, XCircle, Download, Clock, FileCheck, FileX, ArrowUpRight, ShieldCheck, UserCheck } from 'lucide-react'

type DifferenceStatus = DifferenceItem['status']
type DifferenceCategory = DifferenceItem['category']
type AuditAction = AuditLog['action']

const STATUS_MAP: Record<DifferenceStatus, { label: string; cls: string }> = {
  open: { label: '待处理', cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
  pending_review: { label: '待复核', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  resolved: { label: '已解决', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  rejected: { label: '已退回', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
}

const CATEGORY_MAP: Record<DifferenceCategory, string> = {
  split_row: '拆行记录',
  data_mismatch: '数据不一致',
  duplicate: '重复导入',
  other: '其他',
}

const ACTION_MAP: Record<AuditAction, { label: string; cls: string }> = {
  import: { label: '导入', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  supplement: { label: '补录', cls: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  conflict_resolve: { label: '冲突处理', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  review: { label: '复核', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  export: { label: '导出', cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
}

function StatusBadge({ status }: { status: DifferenceStatus }) {
  const { label, cls } = STATUS_MAP[status]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

function ActionBadge({ action }: { action: AuditAction }) {
  const { label, cls } = ACTION_MAP[action]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

interface ReviewFormProps {
  itemId: string
  result: 'resolved' | 'rejected'
  onConfirm: (id: string, result: 'resolved' | 'rejected', reviewer: string, note?: string) => void
  onCancel: () => void
}

function ReviewForm({ itemId, result, onConfirm, onCancel }: ReviewFormProps) {
  const [reviewer, setReviewer] = useState('')
  const [note, setNote] = useState('')
  const isApprove = result === 'resolved'
  return (
    <div className="flex items-center gap-2 mt-1 p-2 bg-slate-700/50 rounded-lg">
      <input
        value={reviewer}
        onChange={(e) => setReviewer(e.target.value)}
        placeholder="复核人"
        className="px-2 py-1 text-xs bg-slate-900/60 border border-slate-600 rounded text-slate-200 placeholder-slate-500 w-20"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注(选填)"
        className="px-2 py-1 text-xs bg-slate-900/60 border border-slate-600 rounded text-slate-200 placeholder-slate-500 w-28"
      />
      <button
        onClick={() => reviewer.trim() && onConfirm(itemId, result, reviewer.trim(), note.trim() || undefined)}
        disabled={!reviewer.trim()}
        className={`px-2 py-1 text-xs rounded font-medium ${isApprove ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        确认
      </button>
      <button onClick={onCancel} className="px-2 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200">
        取消
      </button>
    </div>
  )
}

export default function ReconciliationPage() {
  const { differenceItems, auditLogs, currentRole, reviewDifference, exportData } = useStore()
  const [statusFilter, setStatusFilter] = useState<DifferenceStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<DifferenceCategory | 'all'>('all')
  const [searchNo, setSearchNo] = useState('')
  const [activeForm, setActiveForm] = useState<{ id: string; result: 'resolved' | 'rejected' } | null>(null)

  const filtered = differenceItems.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (searchNo && !item.businessNo.toLowerCase().includes(searchNo.toLowerCase())) return false
    return true
  })

  const sortedLogs = [...auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const handleReview = (id: string, result: 'resolved' | 'rejected', reviewer: string, note?: string) => {
    reviewDifference(id, result === 'resolved', reviewer, note)
    setActiveForm(null)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-amber-400" />
          差异清单与复核
        </h1>
        <p className="text-slate-400 text-sm mt-1">OTC期权敲入监控 · 对账差异管理与复核审批</p>
      </div>

      <div className="rounded-xl shadow-lg bg-slate-800/50 border border-slate-700/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-400" />
            差异清单
          </h2>
          <button
            onClick={() => {
              const data = exportData()
              const blob = new Blob([data], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `otc-knockin-export-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 border border-slate-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DifferenceStatus | 'all')}
              className="bg-slate-900/60 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="all">全部状态</option>
              <option value="open">待处理</option>
              <option value="pending_review">待复核</option>
              <option value="resolved">已解决</option>
              <option value="rejected">已退回</option>
            </select>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as DifferenceCategory | 'all')}
            className="bg-slate-900/60 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="all">全部类别</option>
            <option value="split_row">拆行记录</option>
            <option value="data_mismatch">数据不一致</option>
            <option value="duplicate">重复导入</option>
            <option value="other">其他</option>
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={searchNo}
              onChange={(e) => setSearchNo(e.target.value)}
              placeholder="搜索业务号"
              className="pl-8 pr-3 py-1.5 bg-slate-900/60 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 w-40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400">
                <th className="text-left py-3 px-3 font-medium">业务号</th>
                <th className="text-left py-3 px-3 font-medium">差异类别</th>
                <th className="text-left py-3 px-3 font-medium">描述</th>
                <th className="text-left py-3 px-3 font-medium">状态</th>
                <th className="text-left py-3 px-3 font-medium">复核人</th>
                <th className="text-left py-3 px-3 font-medium">复核备注</th>
                <th className="text-left py-3 px-3 font-medium">创建时间</th>
                <th className="text-left py-3 px-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                  <td className="py-3 px-3 text-slate-200 font-mono text-xs">
                    <span className="flex items-center gap-1">{item.businessNo} <ArrowUpRight className="w-3 h-3 text-slate-500" /></span>
                  </td>
                  <td className="py-3 px-3 text-slate-300">{CATEGORY_MAP[item.category]}</td>
                  <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{item.description}</td>
                  <td className="py-3 px-3"><StatusBadge status={item.status} /></td>
                  <td className="py-3 px-3 text-slate-400">{item.reviewedBy || '—'}</td>
                  <td className="py-3 px-3 text-slate-400 max-w-[120px] truncate">{item.reviewNote || '—'}</td>
                  <td className="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">{item.createdAt}</td>
                  <td className="py-3 px-3">
                    {item.status === 'pending_review' && currentRole === 'supervisor' && (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setActiveForm({ id: item.id, result: 'resolved' })}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600/80 hover:bg-emerald-500 text-white transition-colors"
                          >
                            <Check className="w-3 h-3" /> 通过
                          </button>
                          <button
                            onClick={() => setActiveForm({ id: item.id, result: 'rejected' })}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-600/80 hover:bg-red-500 text-white transition-colors"
                          >
                            <XCircle className="w-3 h-3" /> 退回
                          </button>
                        </div>
                        {activeForm?.id === item.id && (
                          <ReviewForm
                            itemId={item.id}
                            result={activeForm.result}
                            onConfirm={handleReview}
                            onCancel={() => setActiveForm(null)}
                          />
                        )}
                      </div>
                    )}
                    {item.status === 'pending_review' && currentRole === 'operator' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        <Clock className="w-3 h-3" /> 需结算主管复核
                      </span>
                    )}
                    {item.status !== 'pending_review' && (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">暂无匹配的差异记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl shadow-lg bg-slate-800/50 border border-slate-700/50 p-5">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-400" />
          操作历史记录
        </h2>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-700/50" />
          <div className="space-y-4">
            {sortedLogs.map((log) => (
              <div key={log.id} className="relative flex items-start gap-3">
                <div className="absolute left-[-18px] top-1.5 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-slate-500 whitespace-nowrap">{log.timestamp}</span>
                    <ActionBadge action={log.action} />
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> {log.operator}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{log.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
