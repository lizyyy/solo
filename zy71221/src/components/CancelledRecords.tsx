import { useEffect, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { FileX } from 'lucide-react'

export default function CancelledRecords() {
  const reservations = useStore((s) => s.reservations)
  const fetchReservations = useStore((s) => s.fetchReservations)

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  const filtered = useMemo(() => {
    return reservations.filter(
      (r: any) => r.status === 'cancelled' || r.status === 'compensation_error'
    )
  }, [reservations])

  const getCompensationBadge = (status: string | null | undefined) => {
    if (status === 'success') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">回补成功</span>
    if (status === 'failed') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700/50">回补异常</span>
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/50">未知</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileX className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-100">已撤单记录</h2>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <FileX className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">暂无撤单记录</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>单号</th>
                <th>客户账户</th>
                <th>客户名称</th>
                <th>证券代码</th>
                <th>证券名称</th>
                <th>数量</th>
                <th>撤单日期</th>
                <th>撤单原因</th>
                <th>补偿状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className={r.status === 'compensation_error' ? 'bg-red-900/20' : ''}>
                  <td className="text-slate-300">#{r.id}</td>
                  <td className="text-slate-200">{r.client_account}</td>
                  <td className="text-slate-200">{r.client_name}</td>
                  <td className="text-slate-200">{r.security_code}</td>
                  <td className="text-slate-200">{r.security_name}</td>
                  <td className="text-slate-200">{r.quantity?.toLocaleString()}</td>
                  <td className="text-slate-200">{r.cancel_date || '-'}</td>
                  <td className="text-slate-300 max-w-[200px] truncate" title={r.cancel_reason}>{r.cancel_reason || '-'}</td>
                  <td>{getCompensationBadge(r.compensation_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
