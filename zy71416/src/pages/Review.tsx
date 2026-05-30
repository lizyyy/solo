import { useState, useEffect } from 'react'
import { Search, ShieldCheck, AlertTriangle, XCircle, Info, CheckCircle, Eye } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import type { TransactionWithDetails, RiskFlag } from '../../shared/types'

const statusMap: Record<string, string> = {
  pending: '待复核',
  normal: '正常',
  warning: '预警',
  error: '异常',
}

const statusClass: Record<string, string> = {
  pending: 'status-pending',
  normal: 'status-normal',
  warning: 'status-warning',
  error: 'status-error',
}

const flagTypeLabel: Record<string, string> = {
  budget_overrun: '预算越权',
  mcc_mismatch: '商户类别错配',
  duplicate_reimbursement: '重复报销',
}

const flagTypeIcon: Record<string, typeof AlertTriangle> = {
  budget_overrun: AlertTriangle,
  mcc_mismatch: Info,
  duplicate_reimbursement: XCircle,
}

const decisionLabels: Record<string, string> = {
  approved: '通过',
  rejected: '退回',
  pending_review: '待查',
}

export default function Review() {
  const {
    transactions, loading, fetchTransactions, fetchStats,
    runRiskCheckAll, fetchTransactionDetail, submitReview,
  } = useAppStore()

  const [statusFilter, setStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<TransactionWithDetails | null>(null)
  const [reviewer, setReviewer] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    fetchTransactions(statusFilter || undefined, keyword || undefined)
  }, [statusFilter, keyword, fetchTransactions])

  const handleCheckAll = async () => {
    setChecking(true)
    try {
      await runRiskCheckAll()
      await fetchTransactions(statusFilter || undefined, keyword || undefined)
      await fetchStats()
    } finally {
      setChecking(false)
    }
  }

  const handleSelectRow = async (txn: TransactionWithDetails) => {
    if (selected?.id === txn.id) {
      setSelected(null)
      return
    }
    try {
      await fetchTransactionDetail(txn.id)
      const detail = useAppStore.getState().selectedTransaction
      setSelected(detail)
    } catch {
      setSelected(txn)
    }
    setReviewer('')
    setComment('')
  }

  const handleReview = async (decision: string) => {
    if (!selected || !reviewer.trim()) return
    setSubmitting(true)
    try {
      await submitReview({
        transactionId: selected.id,
        reviewer: reviewer.trim(),
        decision,
        comment: comment || undefined,
      })
      await fetchTransactionDetail(selected.id)
      setSelected(useAppStore.getState().selectedTransaction)
      await fetchStats()
    } finally {
      setSubmitting(false)
    }
  }

  const filterBtns = [
    { value: '', label: '全部' },
    { value: 'pending', label: '待复核' },
    { value: 'normal', label: '正常' },
    { value: 'warning', label: '预警' },
    { value: 'error', label: '异常' },
  ]

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {filterBtns.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.value ? 'bg-navy-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9"
                placeholder="搜索商户、员工、卡号..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <button onClick={handleCheckAll} disabled={checking} className="btn-warning flex items-center gap-2">
              <ShieldCheck size={16} /> {checking ? '校验中...' : '全部风控校验'}
            </button>
          </div>
        </div>

        <div className="card flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">加载中...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">暂无交易记录</div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="text-left px-4 py-3 font-medium">交易编号</th>
                    <th className="text-left px-4 py-3 font-medium">金额</th>
                    <th className="text-left px-4 py-3 font-medium">商户</th>
                    <th className="text-left px-4 py-3 font-medium">员工</th>
                    <th className="text-left px-4 py-3 font-medium">预算科目</th>
                    <th className="text-left px-4 py-3 font-medium">状态</th>
                    <th className="text-left px-4 py-3 font-medium">复核</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      onClick={() => handleSelectRow(txn)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${
                        selected?.id === txn.id ? 'bg-navy-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{txn.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 font-mono">{Number(txn.amount).toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-3">{txn.merchantName}</td>
                      <td className="px-4 py-3">{txn.employee?.name || '-'}</td>
                      <td className="px-4 py-3">{txn.budget?.name || '-'}</td>
                      <td className="px-4 py-3"><span className={statusClass[txn.status]}>{statusMap[txn.status]}</span></td>
                      <td className="px-4 py-3">
                        {txn.reviewResult ? (
                          <span className={`text-xs font-medium ${
                            txn.reviewResult.decision === 'approved' ? 'text-emerald-600' :
                            txn.reviewResult.decision === 'rejected' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {decisionLabels[txn.reviewResult.decision]}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">未复核</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="w-[420px] flex-shrink-0 overflow-y-auto">
          <DetailPanel
            txn={selected}
            reviewer={reviewer}
            comment={comment}
            submitting={submitting}
            onReviewerChange={setReviewer}
            onCommentChange={setComment}
            onReview={handleReview}
          />
        </div>
      )}
    </div>
  )
}

function DetailPanel({
  txn, reviewer, comment, submitting,
  onReviewerChange, onCommentChange, onReview,
}: {
  txn: TransactionWithDetails
  reviewer: string
  comment: string
  submitting: boolean
  onReviewerChange: (v: string) => void
  onCommentChange: (v: string) => void
  onReview: (decision: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Eye size={16} /> 交易详情
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">交易编号</span>
            <span className="font-mono text-xs">{txn.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">卡号</span>
            <span className="font-mono">{txn.cardNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">金额</span>
            <span className="font-mono font-semibold">{Number(txn.amount).toLocaleString('zh-CN')} 元</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">商户</span>
            <span>{txn.merchantName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">MCC</span>
            <span className="font-mono">{txn.mcc}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">交易时间</span>
            <span>{txn.transactionTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">员工</span>
            <span>{txn.employee?.name || '-'}{txn.employee?.department ? ` (${txn.employee.department})` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">预算科目</span>
            <span>{txn.budget?.name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">状态</span>
            <span className={statusClass[txn.status]}>{statusMap[txn.status]}</span>
          </div>
        </div>
      </div>

      {txn.riskFlags && txn.riskFlags.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> 风控标记
          </h3>
          <div className="space-y-3">
            {txn.riskFlags.map((flag) => (
              <RiskFlagCard key={flag.id} flag={flag} />
            ))}
          </div>
        </div>
      )}

      {txn.reviewResult && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">复核结果</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">复核人</span>
              <span>{txn.reviewResult.reviewer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">结论</span>
              <span className={`font-medium ${
                txn.reviewResult.decision === 'approved' ? 'text-emerald-600' :
                txn.reviewResult.decision === 'rejected' ? 'text-red-600' : 'text-amber-600'
              }`}>{decisionLabels[txn.reviewResult.decision]}</span>
            </div>
            {txn.reviewResult.comment && (
              <div>
                <span className="text-slate-500">意见</span>
                <p className="mt-1 text-slate-700 bg-slate-50 rounded p-2">{txn.reviewResult.comment}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <CheckCircle size={16} /> 提交复核
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">复核人 *</label>
            <input className="input-field" value={reviewer} onChange={(e) => onReviewerChange(e.target.value)} placeholder="输入姓名" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">复核意见</label>
            <textarea className="input-field h-20" value={comment} onChange={(e) => onCommentChange(e.target.value)} placeholder="输入意见（可选）" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => onReview('approved')} disabled={submitting || !reviewer.trim()} className="btn-success flex-1">
              通过
            </button>
            <button onClick={() => onReview('rejected')} disabled={submitting || !reviewer.trim()} className="btn-danger flex-1">
              退回
            </button>
            <button onClick={() => onReview('pending_review')} disabled={submitting || !reviewer.trim()} className="btn-warning flex-1">
              待查
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RiskFlagCard({ flag }: { flag: RiskFlag }) {
  const Icon = flagTypeIcon[flag.type] || AlertTriangle

  return (
    <div className={`border rounded-lg p-4 ${
      flag.severity === 'error' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={flag.severity === 'error' ? 'text-red-500' : 'text-amber-500'} />
        <span className="font-medium text-sm">{flagTypeLabel[flag.type]}</span>
        <span className={`status-badge ${flag.severity === 'error' ? 'status-error' : 'status-warning'}`}>
          {flag.severity === 'error' ? '异常' : '预警'}
        </span>
      </div>
      <div className={`rounded-lg p-3 border ${
        flag.severity === 'error'
          ? 'bg-red-100/60 border-red-200'
          : 'bg-amber-100/60 border-amber-200'
      }`}>
        <div className="flex items-start gap-2">
          <Info size={16} className={`flex-shrink-0 mt-0.5 ${
            flag.severity === 'error' ? 'text-red-500' : 'text-amber-500'
          }`} />
          <p className="text-sm leading-relaxed">{flag.humanReason}</p>
        </div>
      </div>
    </div>
  )
}
