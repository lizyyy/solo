import { useStore } from '@/store/useStore'
import { Warehouse, Lock, Unlock, AlertTriangle } from 'lucide-react'

export default function InventoryBoard() {
  const inventory = useStore((s) => s.inventory)
  const reservations = useStore((s) => s.reservations)

  const totalStock = inventory.reduce((sum, item) => sum + (item.total_qty ?? 0), 0)
  const totalLocked = inventory.reduce((sum, item) => sum + (item.locked_qty ?? 0), 0)
  const totalAvailable = inventory.reduce((sum, item) => sum + (item.available_qty ?? 0), 0)
  const overdueCount = reservations.filter((r) => r.status === 'overdue').length

  const stats = [
    { label: '总库存', value: totalStock, icon: Warehouse, color: 'blue' },
    { label: '已锁定', value: totalLocked, icon: Lock, color: 'amber' },
    { label: '可分配', value: totalAvailable, icon: Unlock, color: 'emerald' },
    { label: '逾期数', value: overdueCount, icon: AlertTriangle, color: 'red' },
  ]

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-500/10 border-blue-500/20', icon: 'text-blue-400' },
    amber: { bg: 'bg-amber-500/10 border-amber-500/20', icon: 'text-amber-400' },
    emerald: { bg: 'bg-emerald-500/10 border-emerald-500/20', icon: 'text-emerald-400' },
    red: { bg: 'bg-red-500/10 border-red-500/20', icon: 'text-red-400' },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const c = colorMap[stat.color]
          return (
            <div key={stat.label} className={`stat-card ${c.bg} flex items-center gap-4`}>
              <div className={`${c.icon}`}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="font-mono text-2xl font-bold text-slate-100">
                  {stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
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
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.security_code}>
                <td>{item.security_code}</td>
                <td className="!font-sans">{item.security_name}</td>
                <td>{item.total_qty?.toLocaleString()}</td>
                <td>{item.locked_qty?.toLocaleString()}</td>
                <td className={item.available_qty <= 0 ? 'text-red-400 font-bold' : ''}>
                  {item.available_qty?.toLocaleString()}
                </td>
                <td>
                  {item.available_qty < 0 ? (
                    <span className="text-red-400 font-semibold">超分</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">正常</span>
                  )}
                </td>
              </tr>
            ))}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-8 !font-sans">
                  暂无库存数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
