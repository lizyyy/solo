import { useEffect, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { BarChart3, Download, Search, RotateCcw } from 'lucide-react'

export default function AllocationReport() {
  const inventory = useStore((s) => s.inventory)
  const reservations = useStore((s) => s.reservations)
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const resetFilter = useStore((s) => s.resetFilter)
  const fetchInventory = useStore((s) => s.fetchInventory)
  const fetchReservations = useStore((s) => s.fetchReservations)

  useEffect(() => {
    fetchInventory()
    fetchReservations()
  }, [fetchInventory, fetchReservations])

  const summary = useMemo(() => {
    const map = new Map<string, { code: string; name: string; total: number; locked: number }>()
    for (const item of inventory) {
      const key = item.security_code
      if (!map.has(key)) {
        map.set(key, {
          code: item.security_code,
          name: item.security_name,
          total: 0,
          locked: 0,
        })
      }
      const entry = map.get(key)!
      entry.total += item.total_qty ?? 0
      entry.locked += item.locked_qty ?? 0
    }
    return Array.from(map.values())
  }, [inventory])

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

  const getLockRateColor = (rate: number) => {
    if (rate > 80) return 'text-red-400 font-bold'
    if (rate > 50) return 'text-amber-400 font-medium'
    return 'text-emerald-400'
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filter.security_code) params.set('security_code', filter.security_code)
    if (filter.client_account) params.set('client_account', filter.client_account)
    if (filter.status) params.set('status', filter.status)
    if (filter.date_from) params.set('date_from', filter.date_from)
    if (filter.date_to) params.set('date_to', filter.date_to)
    const qs = params.toString()
    window.location.href = `/api/reports/export${qs ? '?' + qs : ''}`
  }

  const handleSearch = () => {
    fetchReservations()
  }

  const handleReset = () => {
    resetFilter()
    fetchReservations({
      security_code: '',
      client_account: '',
      status: '',
      date_from: '',
      date_to: '',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-slate-100">分配报表</h2>
        </div>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>证券代码</th>
              <th>证券名称</th>
              <th>总库存</th>
              <th>已锁定</th>
              <th>可分配</th>
              <th>锁定率</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-8">暂无库存数据</td>
              </tr>
            ) : (
              summary.map((s) => {
                const available = s.total - s.locked
                const rate = s.total > 0 ? (s.locked / s.total) * 100 : 0
                return (
                  <tr key={s.code}>
                    <td className="text-slate-200">{s.code}</td>
                    <td className="text-slate-200">{s.name}</td>
                    <td className="text-slate-200">{s.total.toLocaleString()}</td>
                    <td className="text-amber-400">{s.locked.toLocaleString()}</td>
                    <td className="text-emerald-400">{available.toLocaleString()}</td>
                    <td className={getLockRateColor(rate)}>{rate.toFixed(1)}%</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 pt-2">
          <h3 className="text-base font-semibold text-slate-200">预约明细</h3>
          <span className="text-sm text-slate-500">共 {reservations.length} 条记录</span>
        </div>

        <div className="flex flex-wrap items-end gap-3 bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">证券代码</label>
            <input
              type="text"
              value={filter.security_code}
              onChange={(e) => setFilter({ security_code: e.target.value })}
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
              <option value="">全部</option>
              <option value="locked">已锁定</option>
              <option value="overdue">逾期未还</option>
              <option value="returned">已归还</option>
              <option value="cancelled">已撤单</option>
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
                <th>证券代码</th>
                <th>证券名称</th>
                <th>数量</th>
                <th>预约日期</th>
                <th>到期日期</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-slate-500 py-8">暂无预约记录</td>
                </tr>
              ) : (
                reservations.map((r: any) => (
                  <tr key={r.id}>
                    <td className="text-slate-300">#{r.id}</td>
                    <td className="text-slate-200">{r.client_account}</td>
                    <td className="text-slate-200">{r.client_name}</td>
                    <td className="text-slate-200">{r.security_code}</td>
                    <td className="text-slate-200">{r.security_name}</td>
                    <td className="text-slate-200">{r.quantity?.toLocaleString()}</td>
                    <td className="text-slate-200">{r.reserve_date}</td>
                    <td className="text-slate-200">{r.due_date}</td>
                    <td>{getStatusBadge(r.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
