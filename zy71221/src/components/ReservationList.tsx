import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Search, RotateCcw, Plus, Pencil, RotateCcw as ReturnIcon, Ban } from 'lucide-react'

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'locked', label: '已锁定' },
  { value: 'returned', label: '已归还' },
  { value: 'overdue', label: '逾期未还' },
  { value: 'cancelled', label: '已撤单' },
  { value: 'compensation_error', label: '回补异常' },
]

export default function ReservationList() {
  const reservations = useStore((s) => s.reservations)
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const resetFilter = useStore((s) => s.resetFilter)
  const fetchReservations = useStore((s) => s.fetchReservations)
  const openCreateDrawer = useStore((s) => s.openCreateDrawer)
  const openEditDrawer = useStore((s) => s.openEditDrawer)
  const openConfirmDialog = useStore((s) => s.openConfirmDialog)

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-slate-700/60 text-slate-300 border-slate-600',
      locked: 'bg-blue-900/50 text-blue-300 border-blue-700',
      returned: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
      overdue: 'bg-red-900/50 text-red-300 border-red-700',
      cancelled: 'bg-slate-700/50 text-slate-400 border-slate-600',
      compensation_error: 'bg-red-900/30 text-red-400 border-red-600 border-2',
    }
    const labels: Record<string, string> = {
      pending: '待确认',
      locked: '已锁定',
      returned: '已归还',
      overdue: '逾期未还',
      cancelled: '已撤单',
      compensation_error: '回补异常',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] || 'bg-slate-600 text-slate-200'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getPriorityLabel = (p: number) => {
    const labels: Record<number, string> = { 1: '最高', 2: '高', 3: '中', 4: '低', 5: '最低' }
    const colors: Record<number, string> = { 1: 'text-red-400', 2: 'text-amber-400', 3: 'text-blue-400', 4: 'text-slate-300', 5: 'text-slate-500' }
    return <span className={colors[p] || 'text-slate-400'}>{labels[p] || `${p}`}</span>
  }

  const getDaysDisplay = (days: number | null | undefined, status: string) => {
    if (days === null || days === undefined) return <span className="text-slate-500">-</span>
    if (days < 0) return <span className="text-red-400 font-medium">逾期{-days}天</span>
    if (days <= 3) return <span className="text-amber-400">{days}天</span>
    return <span className="text-slate-300">{days}天</span>
  }

  const handleSearch = () => {
    fetchReservations()
  }

  const handleReset = () => {
    resetFilter()
    setTimeout(() => fetchReservations(), 10)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">预约单管理</h2>
        <button onClick={openCreateDrawer} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          新建预约
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">证券代码</label>
          <input
            type="text"
            value={filter.security_code}
            onChange={(e) => setFilter({ security_code: e.target.value })}
            onKeyDown={handleKeyDown}
            className="input-field w-32"
            placeholder="证券代码"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">客户账户</label>
          <input
            type="text"
            value={filter.client_account}
            onChange={(e) => setFilter({ client_account: e.target.value })}
            onKeyDown={handleKeyDown}
            className="input-field w-32"
            placeholder="客户账户"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">状态</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ status: e.target.value })}
            className="input-field w-28"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">开始日期</label>
          <input
            type="date"
            value={filter.date_from}
            onChange={(e) => setFilter({ date_from: e.target.value })}
            className="input-field w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">结束日期</label>
          <input
            type="date"
            value={filter.date_to}
            onChange={(e) => setFilter({ date_to: e.target.value })}
            className="input-field w-36"
          />
        </div>
        <button onClick={handleSearch} className="btn-primary flex items-center gap-1.5 h-[38px]">
          <Search className="w-4 h-4" />
          查询
        </button>
        <button onClick={handleReset} className="btn-secondary flex items-center gap-1.5 h-[38px]">
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>单号</th>
              <th>客户账户</th>
              <th>客户名称</th>
              <th>优先级</th>
              <th>证券代码</th>
              <th>证券名称</th>
              <th>数量</th>
              <th>状态</th>
              <th>预约日期</th>
              <th>到期日期</th>
              <th>剩余天数</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center text-slate-500 py-8">暂无预约记录</td>
              </tr>
            ) : (
              reservations.map((r: any) => (
                <tr key={r.id} className={r.status === 'overdue' ? 'bg-red-900/10' : ''}>
                  <td className="text-slate-300">#{r.id}</td>
                  <td className="text-slate-200">{r.client_account}</td>
                  <td className="text-slate-200">{r.client_name}</td>
                  <td>{getPriorityLabel(r.client_priority)}</td>
                  <td className="text-slate-200">{r.security_code}</td>
                  <td className="text-slate-200">{r.security_name}</td>
                  <td className="text-slate-200">{r.quantity?.toLocaleString()}</td>
                  <td>{getStatusBadge(r.status)}</td>
                  <td className="text-slate-200">{r.reserve_date}</td>
                  <td className="text-slate-200">{r.due_date}</td>
                  <td>{getDaysDisplay(r.days_until_due, r.status)}</td>
                  <td className="text-right">
                    {r.status === 'locked' && (
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEditDrawer(r)} className="inline-flex items-center px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors" title="修正">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openConfirmDialog('return', r)} className="inline-flex items-center px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" title="归还">
                          <ReturnIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openConfirmDialog('cancel', r)} className="inline-flex items-center px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors" title="撤单">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {r.status === 'overdue' && (
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openConfirmDialog('return', r)} className="inline-flex items-center px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" title="归还">
                          <ReturnIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openConfirmDialog('cancel', r)} className="inline-flex items-center px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors" title="撤单">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
