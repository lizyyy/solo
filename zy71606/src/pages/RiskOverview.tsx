import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import StatusBadge from '@/components/StatusBadge'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Search, Send, Shield, ShieldAlert, ShieldX, AlertTriangle } from 'lucide-react'
import type { RiskLevel, NotificationType } from '@/lib/api'

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: '#22c55e',
  warning: '#eab308',
  margin_call: '#f97316',
  force_liquidation: '#ef4444',
}

const RISK_ICONS: Record<RiskLevel, typeof Shield> = {
  safe: Shield,
  warning: AlertTriangle,
  margin_call: ShieldAlert,
  force_liquidation: ShieldX,
}

function RiskRateBar({ rate }: { rate: number }) {
  const level: RiskLevel =
    rate >= 150 ? 'force_liquidation' : rate >= 130 ? 'margin_call' : rate >= 100 ? 'warning' : 'safe'
  const pct = Math.min(rate / 2, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 rounded-full bg-bg-primary overflow-hidden">
        <div
          className={`h-full rounded-full ${
            level === 'safe' ? 'bg-safe' : level === 'warning' ? 'bg-warning' : level === 'margin_call' ? 'bg-margin-call' : 'bg-force-liq'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono-num text-xs text-text-primary">{rate.toFixed(2)}%</span>
    </div>
  )
}

function DashboardCard({
  level,
  count,
  total,
}: {
  level: RiskLevel
  count: number
  total: number
}) {
  const Icon = RISK_ICONS[level]
  const labels: Record<RiskLevel, string> = {
    safe: '安全',
    warning: '预警',
    margin_call: '追保',
    force_liquidation: '强平',
  }
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4 flex items-center gap-4">
      <div className="w-16 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { value: count },
                { value: Math.max(total - count, 0) },
              ]}
              dataKey="value"
              innerRadius={16}
              outerRadius={28}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              <Cell fill={RISK_COLORS[level]} />
              <Cell fill="#334155" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={16} style={{ color: RISK_COLORS[level] }} />
          <span className="text-sm text-text-secondary">{labels[level]}</span>
        </div>
        <span className="font-heading font-bold text-2xl text-text-primary">{count}</span>
      </div>
    </div>
  )
}

export default function RiskOverview() {
  const { list, total, filters, loading } = useAppStore(s => s.clients)
  const fetchClients = useAppStore(s => s.fetchClients)
  const setClientFilters = useAppStore(s => s.setClientFilters)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const showConfirmModal = useAppStore(s => s.showConfirmModal)

  useEffect(() => {
    fetchClients()
  }, [fetchClients, filters.search, filters.risk_level, filters.page])

  const counts = {
    safe: list.filter(c => c.risk_level === 'safe').length,
    warning: list.filter(c => c.risk_level === 'warning').length,
    margin_call: list.filter(c => c.risk_level === 'margin_call').length,
    force_liquidation: list.filter(c => c.risk_level === 'force_liquidation').length,
  }

  const highRiskClients = list
    .filter(c => c.risk_level === 'margin_call' || c.risk_level === 'force_liquidation')
    .sort((a, b) => b.risk_rate - a.risk_rate)

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSendNotifications = () => {
    const selected = highRiskClients.filter(c => selectedIds.has(c.id))
    showConfirmModal(
      '批量发送通知',
      `确认向 ${selected.length} 位客户发送催缴通知？`,
      () => {}
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(RISK_COLORS) as RiskLevel[]).map(level => (
          <DashboardCard key={level} level={level} count={counts[level]} total={total || list.length} />
        ))}
      </div>

      <div className="bg-bg-card border border-border rounded-lg">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="搜索客户名称/账号"
              value={filters.search}
              onChange={e => setClientFilters({ search: e.target.value, page: 1 })}
              className="w-full bg-bg-secondary border border-border rounded-md pl-9 pr-4 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={filters.risk_level}
            onChange={e => setClientFilters({ risk_level: (e.target.value || '') as RiskLevel | '', page: 1 })}
            className="bg-bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">全部风险</option>
            <option value="safe">安全</option>
            <option value="warning">预警</option>
            <option value="margin_call">追保</option>
            <option value="force_liquidation">强平</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left px-4 py-3 font-medium">客户名称</th>
                <th className="text-left px-4 py-3 font-medium">账号</th>
                <th className="text-right px-4 py-3 font-medium">权益</th>
                <th className="text-right px-4 py-3 font-medium">保证金占用</th>
                <th className="text-left px-4 py-3 font-medium">风险率</th>
                <th className="text-left px-4 py-3 font-medium">风险等级</th>
                <th className="text-left px-4 py-3 font-medium">最近通知</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-text-secondary">加载中...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-text-secondary">暂无数据</td></tr>
              ) : (
                list.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-text-primary">{c.name}</td>
                    <td className="px-4 py-3 font-mono-num text-text-secondary">{c.account}</td>
                    <td className="px-4 py-3 font-mono-num text-right text-text-primary">
                      {c.equity.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-mono-num text-right text-text-primary">
                      {c.margin_used.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3"><RiskRateBar rate={c.risk_rate} /></td>
                    <td className="px-4 py-3"><StatusBadge type="risk" value={c.risk_level} /></td>
                    <td className="px-4 py-3 text-text-secondary">--</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-heading font-semibold text-text-primary">待催缴队列</h3>
          <button
            onClick={handleSendNotifications}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            发送通知 ({selectedIds.size})
          </button>
        </div>
        <div className="divide-y divide-border/50">
          {highRiskClients.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">暂无待催缴客户</div>
          ) : (
            highRiskClients.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-bg-secondary/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="w-4 h-4 rounded border-border bg-bg-secondary accent-accent"
                />
                <span className="text-sm text-text-primary w-24 truncate">{c.name}</span>
                <span className="font-mono-num text-xs text-text-secondary w-28">{c.account}</span>
                <div className="flex-1"><RiskRateBar rate={c.risk_rate} /></div>
                <StatusBadge type="risk" value={c.risk_level} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
