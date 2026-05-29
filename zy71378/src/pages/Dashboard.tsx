import { useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { ShieldCheck, FileCheck, Clock, RefreshCw, AlertTriangle } from 'lucide-react'
import { useCallbackStore } from '@/store/useCallbackStore'
import StatsCard from '@/components/StatsCard'
import StatusBadge from '@/components/StatusBadge'

const PIE_COLORS = [
  'var(--color-emerald)',
  'var(--color-blue)',
  'var(--color-red)',
  'var(--color-amber)',
  'var(--color-text-secondary)',
]

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { color?: string; name?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl">
      <p className="text-xs text-[var(--color-text-secondary)] font-mono mb-1">{label}</p>
      {payload.map((item, i: number) => (
        <p key={i} className="text-sm font-mono" style={{ color: item.color }}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const {
    statsOverview,
    fetchStatsOverview,
    retryDistribution,
    fetchRetryDistribution,
    statusDistribution,
    fetchStatusDistribution,
    trendData,
    fetchTrend,
    callbacks,
    fetchCallbacks,
  } = useCallbackStore()

  useEffect(() => {
    fetchStatsOverview()
    fetchRetryDistribution()
    fetchStatusDistribution()
    fetchTrend()
    fetchCallbacks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingCallbacks = callbacks.filter((c) => c.confirm_status === 'pending')

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">总览仪表板</h2>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="总回调量"
          value={statsOverview?.total_callbacks ?? '-'}
          icon={<ShieldCheck size={20} />}
          color="amber"
        />
        <StatsCard
          title="签名通过"
          value={statsOverview?.signature_valid ?? '-'}
          icon={<FileCheck size={20} />}
          color="emerald"
        />
        <StatsCard
          title="待确认"
          value={statsOverview?.pending_confirmations ?? '-'}
          icon={<Clock size={20} />}
          color="red"
        />
        <StatsCard
          title="重放完成"
          value={statsOverview?.replay_success ?? '-'}
          icon={<RefreshCw size={20} />}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-5">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">重试分布</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={retryDistribution}>
              <XAxis
                dataKey="retry_count"
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="count" name="回调数" fill="var(--color-amber)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-5">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">状态分布</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusDistribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ status, count }) => `${status}: ${count}`}
              >
                {statusDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-5">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">时间趋势</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<DarkTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
              />
              <Line type="monotone" dataKey="total" name="总量" stroke="var(--color-blue)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="anomaly" name="异常" stroke="var(--color-red)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-[var(--color-amber)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">待确认告警</h3>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin">
            {pendingCallbacks.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)] py-8 text-center">无待确认条目</p>
            )}
            {pendingCallbacks.map((cb) => (
              <div
                key={cb.id}
                className="flex items-center justify-between rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-bg-tertiary)] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm text-[var(--color-text-primary)] truncate">
                    {cb.order_id}
                  </span>
                  <StatusBadge status={cb.signature_status} type="signature" />
                  <StatusBadge status={cb.processing_result} type="processing" />
                </div>
                <span className="font-mono text-xs text-[var(--color-text-secondary)] shrink-0 ml-3">
                  {new Date(cb.timestamp).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
