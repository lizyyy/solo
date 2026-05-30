import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Clock, AlertTriangle, XCircle, FileInput, ShieldCheck, Download } from 'lucide-react'
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

export default function Home() {
  const { stats, transactions, fetchStats, fetchTransactions, loading } = useAppStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
    fetchTransactions()
  }, [fetchStats, fetchTransactions])

  const statCards = [
    { label: '总交易数', value: stats.totalTransactions, icon: Activity, color: 'bg-navy-500' },
    { label: '待复核', value: stats.pendingCount, icon: Clock, color: 'bg-slate-500' },
    { label: '风控预警', value: stats.warningCount, icon: AlertTriangle, color: 'bg-amber-500' },
    { label: '风控异常', value: stats.errorCount, icon: XCircle, color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-3xl font-mono font-semibold mt-1">{value}</p>
              </div>
              <div className={`${color} p-3 rounded-lg text-white`}>
                <Icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">快捷操作</h2>
        <div className="flex gap-3">
          <button onClick={() => navigate('/entry')} className="btn-primary flex items-center gap-2">
            <FileInput size={16} /> 录入交易
          </button>
          <button onClick={() => navigate('/review')} className="btn-warning flex items-center gap-2">
            <ShieldCheck size={16} /> 一键复核
          </button>
          <button onClick={() => navigate('/export')} className="btn-secondary flex items-center gap-2">
            <Download size={16} /> 导出报告
          </button>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">最近交易</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">加载中...</div>
        ) : transactions.length === 0 ? (
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
                  <th className="text-left px-5 py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((txn) => (
                  <tr key={txn.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{txn.id.slice(0, 8)}...</td>
                    <td className="px-5 py-3 font-mono">{Number(txn.amount).toLocaleString('zh-CN')}</td>
                    <td className="px-5 py-3">{txn.merchantName}</td>
                    <td className="px-5 py-3">{txn.employee?.name || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={statusClass[txn.status]}>{statusMap[txn.status]}</span>
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
