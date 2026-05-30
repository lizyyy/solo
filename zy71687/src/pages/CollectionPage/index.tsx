import { useState, useMemo } from 'react'
import {
  DollarSign,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react'
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
} from 'recharts'
import { useStore } from '@/store/useStore'
import type { PlatformTransaction, WithdrawalRecord, Platform, Currency } from '@/data/types'
import KpiCard from '@/components/shared/KpiCard'
import Drawer from '@/components/shared/Drawer'
import DetailTable from '@/components/shared/DetailTable'

const CURRENCY_COLORS: Record<Currency, string> = {
  USD: '#38bdf8',
  EUR: '#00d4aa',
  GBP: '#f59e0b',
  JPY: '#a78bfa',
}

const CURRENCY_LABELS: Record<Currency, string> = {
  USD: '美元',
  EUR: '欧元',
  GBP: '英镑',
  JPY: '日元',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待归集',
  collecting: '归集中',
  collected: '已归集',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  collecting: '#38bdf8',
  collected: '#00d4aa',
}

const WITHDRAWAL_STATUS_MAP: Record<string, string> = {
  pending: '待到账',
  arrived: '已到账',
  delayed: '延迟',
}

function formatAmount(v: number) {
  return `¥${v.toLocaleString('zh-CN')}`
}

type DrawerState =
  | { type: 'platform'; platform: Platform }
  | { type: 'currency'; currency: Currency }
  | { type: 'withdrawal'; id: string }
  | { type: 'board'; status: 'pending' | 'collecting' | 'collected' }
  | null

export default function CollectionPage() {
  const { transactions, withdrawals, kpi } = useStore()
  const [drawer, setDrawer] = useState<DrawerState>(null)

  const barData = useMemo(() => {
    const platforms: Platform[] = ['Amazon', 'Shopee', '独立站']
    const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'JPY']
    return platforms.map((p) => {
      const entry: Record<string, string | number> = { platform: p }
      currencies.forEach((c) => {
        const sum = transactions
          .filter((t) => t.platform === p && t.currency === c)
          .reduce((s, t) => s + t.amount, 0)
        entry[c] = sum
      })
      return entry
    })
  }, [transactions])

  const pieData = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {}
    transactions.forEach((t) => {
      map[t.currency] = (map[t.currency] ?? 0) + t.amount
    })
    return (Object.entries(map) as [Currency, number][])
      .filter(([, v]) => v > 0)
      .map(([currency, value]) => ({ currency, value }))
  }, [transactions])

  const totalAmount = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData])

  const boardData = useMemo(() => {
    const groups: Record<string, { count: number; amount: number; items: PlatformTransaction[] }> = {
      pending: { count: 0, amount: 0, items: [] },
      collecting: { count: 0, amount: 0, items: [] },
      collected: { count: 0, amount: 0, items: [] },
    }
    transactions.forEach((t) => {
      const status = t.status === 'settled' ? 'collected' : t.status === 'pending' ? 'pending' : 'collecting'
      groups[status].count++
      groups[status].amount += t.amount
      groups[status].items.push(t)
    })
    return groups
  }, [transactions])

  const drawerTransactions = useMemo(() => {
    if (!drawer) return []
    if (drawer.type === 'platform') return transactions.filter((t) => t.platform === drawer.platform)
    if (drawer.type === 'currency') return transactions.filter((t) => t.currency === drawer.currency)
    if (drawer.type === 'board') {
      const items = boardData[drawer.status]?.items ?? []
      return items
    }
    return []
  }, [drawer, transactions, boardData])

  const drawerWithdrawal = useMemo<WithdrawalRecord | null>(() => {
    if (drawer?.type === 'withdrawal') {
      return withdrawals.find((w) => w.id === drawer.id) ?? null
    }
    return null
  }, [drawer, withdrawals])

  const drawerTitle = useMemo(() => {
    if (!drawer) return ''
    if (drawer.type === 'platform') return `${drawer.platform} 交易明细`
    if (drawer.type === 'currency') return `${CURRENCY_LABELS[drawer.currency]} 交易明细`
    if (drawer.type === 'withdrawal') return '提款详情'
    if (drawer.type === 'board') return `${STATUS_LABELS[drawer.status]} 明细`
    return ''
  }, [drawer])

  const txColumns = useMemo(
    () => [
      { key: 'id', title: 'ID' },
      { key: 'platform', title: '平台' },
      { key: 'orderId', title: '订单号' },
      { key: 'currency', title: '币种' },
      {
        key: 'amount',
        title: '金额',
        render: (v: unknown) => formatAmount(v as number),
      },
      {
        key: 'status',
        title: '状态',
        render: (v: unknown) => STATUS_LABELS[v as string] ?? (v as string),
      },
      { key: 'transactionDate', title: '交易日期' },
    ],
    []
  )

  const wdColumns = useMemo(
    () => [
      { key: 'id', title: 'ID' },
      { key: 'platform', title: '平台' },
      { key: 'currency', title: '币种' },
      {
        key: 'amount',
        title: '金额',
        render: (v: unknown) => formatAmount(v as number),
      },
      { key: 'requestDate', title: '申请日期' },
      { key: 'actualArrivalDate', title: '实际到账' },
      {
        key: 'status',
        title: '状态',
        render: (v: unknown) => WITHDRAWAL_STATUS_MAP[v as string] ?? (v as string),
      },
      { key: 'delayReason', title: '延迟原因' },
    ],
    []
  )

  return (
    <div className="min-h-screen bg-[#0f1219] p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="待结汇总额"
          value={formatAmount(kpi.totalPendingSettlement)}
          icon={<DollarSign size={18} />}
          color="#38bdf8"
        />
        <KpiCard
          label="已锁汇金额"
          value={formatAmount(kpi.totalForwardLocked)}
          icon={<Lock size={18} />}
          color="#00d4aa"
        />
        <KpiCard
          label="未锁汇缺口"
          value={formatAmount(kpi.totalUncoveredGap)}
          icon={<Unlock size={18} />}
          color="#f59e0b"
        />
        <KpiCard
          label="异常笔数"
          value={String(kpi.exceptionCount)}
          icon={<AlertTriangle size={18} />}
          color="#ef4444"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">平台收款分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} onClick={(e) => {
              if (e?.activePayload?.length) {
                const platform = e.activePayload[0].payload.platform as Platform
                setDrawer({ type: 'platform', platform })
              }
            }}>
              <XAxis dataKey="platform" stroke="#2a3040" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis stroke="#2a3040" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f2e',
                  border: '1px solid #2a3040',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              {(['USD', 'EUR', 'GBP', 'JPY'] as Currency[]).map((c) => (
                <Bar key={c} dataKey={c} fill={CURRENCY_COLORS[c]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">币种占比</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart onClick={(e) => {
              if (e?.activePayload?.length) {
                const currency = e.activePayload[0].payload.currency as Currency
                setDrawer({ type: 'currency', currency })
              }
            }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="currency"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                cursor="pointer"
              >
                {pieData.map((d) => (
                  <Cell key={d.currency} fill={CURRENCY_COLORS[d.currency]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1f2e',
                  border: '1px solid #2a3040',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                }}
                formatter={(value: number) => formatAmount(value)}
              />
              <text
                x="50%"
                y="46%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#e5e7eb"
                fontSize={16}
                fontWeight={600}
              >
                {formatAmount(totalAmount)}
              </text>
              <text
                x="50%"
                y="56%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#9ca3af"
                fontSize={11}
              >
                总金额
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">提款到账时间线</h3>
        <div className="space-y-3">
          {withdrawals.map((w) => {
            const isDelayed = w.status === 'delayed'
            const lineColor = isDelayed ? '#ef4444' : '#00d4aa'
            return (
              <div
                key={w.id}
                className="flex items-center gap-4 cursor-pointer hover:bg-[#2a3040]/30 rounded-lg px-3 py-2 transition-colors"
                onClick={() => setDrawer({ type: 'withdrawal', id: w.id })}
              >
                <div className="flex flex-col items-center">
                  <div
                    className="w-3 h-3 rounded-full border-2"
                    style={{ borderColor: lineColor, backgroundColor: isDelayed ? lineColor : 'transparent' }}
                  />
                  <div className="w-0.5 h-8" style={{ backgroundColor: lineColor, opacity: 0.3 }} />
                </div>
                <div className="flex-1 grid grid-cols-6 gap-3 items-center text-sm">
                  <span className="text-gray-400">{w.id}</span>
                  <span className="text-gray-200">{w.platform}</span>
                  <span className="text-gray-200">{w.currency}</span>
                  <span className="text-gray-200 font-medium">{formatAmount(w.amount)}</span>
                  <span className="text-gray-400">{w.requestDate}</span>
                  <div className="flex items-center gap-2">
                    <span className={isDelayed ? 'text-[#ef4444]' : 'text-[#00d4aa]'}>
                      {w.actualArrivalDate}
                    </span>
                    {isDelayed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444]">
                        延迟
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg bg-[#1a1f2e] p-5 border border-[#2a3040]">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">归集看板</h3>
        <div className="grid grid-cols-3 gap-6">
          {(['pending', 'collecting', 'collected'] as const).map((status) => {
            const group = boardData[status]
            return (
              <div
                key={status}
                className="rounded-lg bg-[#0f1219] p-4 border border-[#2a3040] cursor-pointer hover:border-[#3a4050] transition-colors"
                onClick={() => setDrawer({ type: 'board', status })}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                  <span className="text-sm font-medium text-gray-300">{STATUS_LABELS[status]}</span>
                </div>
                <div className="text-2xl font-bold text-white">{group.count}</div>
                <div className="text-sm text-gray-400 mt-1">{formatAmount(group.amount)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <Drawer
        open={drawer !== null}
        title={drawerTitle}
        onClose={() => setDrawer(null)}
      >
        {drawer?.type === 'withdrawal' && drawerWithdrawal ? (
          <DetailTable columns={wdColumns} data={[drawerWithdrawal] as unknown as Record<string, unknown>[]} />
        ) : (
          <DetailTable columns={txColumns} data={drawerTransactions as unknown as Record<string, unknown>[]} />
        )}
      </Drawer>
    </div>
  )
}
