import { useEffect, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { AlertTriangle, RotateCcw as ReturnIcon, Ban } from 'lucide-react'

export default function OverdueAlert() {
  const reservations = useStore((s) => s.reservations)
  const fetchReservations = useStore((s) => s.fetchReservations)
  const markOverdue = useStore((s) => s.markOverdue)
  const openConfirmDialog = useStore((s) => s.openConfirmDialog)

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  const filtered = useMemo(() => {
    return reservations
      .filter((r: any) => r.status === 'locked' || r.status === 'overdue')
      .sort((a: any, b: any) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999))
  }, [reservations])

  const overdueCount = filtered.filter((r: any) => r.status === 'overdue').length
  const expiringCount = filtered.filter((r: any) => r.status === 'locked' && (r.days_until_due ?? 999) <= 7).length

  const getDaysDisplay = (days: number | null | undefined) => {
    if (days === null || days === undefined) return <span className="text-slate-500">-</span>
    if (days < 0) return <span className="text-red-400 font-bold">逾期{-days}天</span>
    if (days <= 3) return <span className="text-amber-400 font-medium">{days}天</span>
    if (days <= 7) return <span className="text-blue-400">{days}天</span>
    return <span className="text-slate-400">{days}天</span>
  }

  const getStatusBadge = (status: string) => {
    if (status === 'overdue') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/60 text-red-300 border border-red-700">逾期未还</span>
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700">已锁定</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-slate-100">归还到期预警</h2>
        </div>
        <button onClick={markOverdue} className="btn-secondary flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          标记逾期
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card bg-slate-900/60 border-slate-600">
          <p className="text-xs text-slate-400 mb-1">即将到期 (7天内)</p>
          <p className="text-2xl font-bold text-amber-400 font-mono">{expiringCount}</p>
        </div>
        <div className="stat-card bg-red-900/30 border-red-700/50">
          <p className="text-xs text-slate-400 mb-1">已逾期</p>
          <p className="text-2xl font-bold text-red-400 font-mono">{overdueCount}</p>
        </div>
        <div className="stat-card bg-slate-900/60 border-slate-600">
          <p className="text-xs text-slate-400 mb-1">需要关注</p>
          <p className="text-2xl font-bold text-slate-200 font-mono">{filtered.length}</p>
        </div>
      </div>

      <p className="text-sm text-slate-400">
        当前有 <span className="text-amber-400 font-medium">{expiringCount}</span> 条预约即将到期，
        <span className="text-red-400 font-medium">{overdueCount}</span> 条已逾期
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <AlertTriangle className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">暂无到期预警记录</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>单号</th>
                <th>客户</th>
                <th>证券</th>
                <th>数量</th>
                <th>到期日期</th>
                <th>剩余天数</th>
                <th>状态</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className={r.status === 'overdue' ? 'bg-red-900/15' : ''}>
                  <td className="text-slate-300">#{r.id}</td>
                  <td className="text-slate-200">{r.client_name}</td>
                  <td className="text-slate-200">{r.security_name} ({r.security_code})</td>
                  <td className="text-slate-200">{r.quantity?.toLocaleString()}</td>
                  <td className="text-slate-200">{r.due_date}</td>
                  <td>{getDaysDisplay(r.days_until_due)}</td>
                  <td>{getStatusBadge(r.status)}</td>
                  <td className="text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openConfirmDialog('return', r)} className="inline-flex items-center px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" title="归还">
                        <ReturnIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openConfirmDialog('cancel', r)} className="inline-flex items-center px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors" title="撤单">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
