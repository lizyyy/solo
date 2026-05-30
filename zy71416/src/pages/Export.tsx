import { useState, useEffect } from 'react'
import { Download, FileText, Activity, Clock, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

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

const decisionLabels: Record<string, string> = {
  approved: '通过',
  rejected: '退回',
  pending_review: '待查',
}

export default function Export() {
  const { stats, transactions, fetchStats, fetchTransactions, loading } = useAppStore()
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetchStats()
    fetchTransactions()
  }, [fetchStats, fetchTransactions])

  const handleFilterChange = (value: string) => {
    setStatusFilter(value)
    fetchTransactions(value || undefined)
  }

  const handleExport = () => {
    window.open('/api/export/csv', '_blank')
  }

  const filtered = statusFilter
    ? transactions.filter((t) => t.status === statusFilter)
    : transactions

  const filterBtns = [
    { value: '', label: '全部' },
    { value: 'pending', label: '待复核' },
    { value: 'normal', label: '正常' },
    { value: 'warning', label: '预警' },
    { value: 'error', label: '异常' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <Activity size={20} className="text-navy-500" />
          <div>
            <p className="text-xs text-slate-500">总交易</p>
            <p className="font-mono font-semibold text-lg">{stats.totalTransactions}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <Clock size={20} className="text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">待复核</p>
            <p className="font-mono font-semibold text-lg">{stats.pendingCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-500" />
          <div>
            <p className="text-xs text-slate-500">预警</p>
            <p className="font-mono font-semibold text-lg">{stats.warningCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <XCircle size={20} className="text-red-500" />
          <div>
            <p className="text-xs text-slate-500">异常</p>
            <p className="font-mono font-semibold text-lg">{stats.errorCount}</p>
          </div>
        </div>
      </div>

      <div className="card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-navy-500" />
          <div>
            <h3 className="font-semibold text-sm">导出CSV报告</h3>
            <p className="text-xs text-slate-500">包含所有交易的完整风控信息和复核结果</p>
          </div>
        </div>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2">
          <Download size={16} /> 导出CSV报告
        </button>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">交易预览</h2>
          <div className="flex gap-1">
            {filterBtns.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilterChange(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === f.value ? 'bg-navy-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">暂无交易记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="text-left px-5 py-3 font-medium">交易编号</th>
                  <th className="text-left px-5 py-3 font-medium">金额</th>
                  <th className="text-left px-5 py-3 font-medium">商户</th>
                  <th className="text-left px-5 py-3 font-medium">员工</th>
                  <th className="text-left px-5 py-3 font-medium">预算科目</th>
                  <th className="text-left px-5 py-3 font-medium">状态</th>
                  <th className="text-left px-5 py-3 font-medium">风控标记</th>
                  <th className="text-left px-5 py-3 font-medium">复核结果</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => (
                  <tr key={txn.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{txn.id.slice(0, 8)}...</td>
                    <td className="px-5 py-3 font-mono">{Number(txn.amount).toLocaleString('zh-CN')}</td>
                    <td className="px-5 py-3">{txn.merchantName}</td>
                    <td className="px-5 py-3">{txn.employee?.name || '-'}</td>
                    <td className="px-5 py-3">{txn.budget?.name || '-'}</td>
                    <td className="px-5 py-3"><span className={statusClass[txn.status]}>{statusMap[txn.status]}</span></td>
                    <td className="px-5 py-3">
                      {txn.riskFlags && txn.riskFlags.length > 0 ? (
                        <div className="space-y-1">
                          {txn.riskFlags.map((f) => (
                            <div key={f.id} className="text-xs">
                              <span className={`status-badge ${f.severity === 'error' ? 'status-error' : 'status-warning'}`}>
                                {flagTypeLabel[f.type]}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">无</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {txn.reviewResult ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <CheckCircle size={12} className={
                            txn.reviewResult.decision === 'approved' ? 'text-emerald-500' :
                            txn.reviewResult.decision === 'rejected' ? 'text-red-500' : 'text-amber-500'
                          } />
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
  )
}
