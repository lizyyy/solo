import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { BANKS, DAILY_TREND_DATA, generateAlerts } from "@/data/mockData"
import FilterPanel from "@/components/FilterPanel"
import { TrendingUp, AlertTriangle, ShieldAlert, Clock, RotateCcw } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts"

const BANK_COLORS: Record<string, string> = {
  "工商银行": "#38bdf8",
  "建设银行": "#34d399",
  "农业银行": "#fbbf24",
  "中国银行": "#a78bfa",
  "交通银行": "#fb7185",
}

const ALERT_LABELS: Record<string, string> = {
  reserve_shortage: "留底不足",
  limit_exceeded: "限额超用",
  duplicate_collect: "重复归集",
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  critical: { border: "border-l-rose-500", bg: "bg-rose-500/15", text: "text-rose-400" },
  warning: { border: "border-l-amber-500", bg: "bg-amber-500/15", text: "text-amber-400" },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const accounts = useStore((s) => s.accounts)
  const filter = useStore((s) => s.filter)
  const sortField = useStore((s) => s.sortField)
  const sortDirection = useStore((s) => s.sortDirection)

  const filtered = useMemo(() => {
    let result = accounts.filter((acc) => {
      if (filter.dateRange[0] && acc.collectDate < filter.dateRange[0]) return false
      if (filter.dateRange[1] && acc.collectDate > filter.dateRange[1]) return false
      if (filter.banks.length > 0 && !filter.banks.includes(acc.bank)) return false
      if (filter.statuses.length > 0 && !filter.statuses.includes(acc.status)) return false
      if (filter.ruleVersion && acc.ruleVersion !== filter.ruleVersion) return false
      if (filter.searchKeyword) {
        const kw = filter.searchKeyword.toLowerCase()
        if (!acc.accountName.toLowerCase().includes(kw) && !acc.accountNo.toLowerCase().includes(kw)) return false
      }
      return true
    })
    result = result.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const dir = sortDirection === "asc" ? 1 : -1
      if (typeof aVal === "string" && typeof bVal === "string") return dir * aVal.localeCompare(bVal)
      return dir * ((aVal as number) - (bVal as number))
    })
    return result
  }, [accounts, filter, sortField, sortDirection])

  const kpi = useMemo(() => ({
    totalCollect: filtered.reduce((sum, acc) => sum + acc.collectAmount, 0),
    reserveShortageCount: filtered.filter((acc) => acc.isReserveShortage).length,
    limitExceededCount: filtered.filter((acc) => acc.isLimitExceeded).length,
    pendingCount: filtered.filter((acc) => acc.status === "pending").length,
    returnedCount: filtered.filter((acc) => acc.status === "returned").length,
  }), [filtered])

  const alerts = useMemo(() => generateAlerts(filtered), [filtered])

  const limitUsageData = useMemo(() => [...filtered]
    .sort((a, b) => (b.limitUsed / b.regLimit) - (a.limitUsed / a.regLimit))
    .slice(0, 8)
    .map((acc) => ({
      name: acc.accountName,
      rate: Math.round((acc.limitUsed / acc.regLimit) * 100),
    })), [filtered])

  const kpiCards = [
    { label: "当日归集总额", value: `${(kpi.totalCollect / 10000).toFixed(1)} 万元`, icon: TrendingUp, color: "text-sky-400", pulse: false, pulseBg: "bg-sky-400" },
    { label: "留底不足笔数", value: kpi.reserveShortageCount, icon: AlertTriangle, color: "text-amber-400", pulse: kpi.reserveShortageCount > 0, pulseBg: "bg-amber-400" },
    { label: "限额超用笔数", value: kpi.limitExceededCount, icon: ShieldAlert, color: "text-rose-400", pulse: kpi.limitExceededCount > 0, pulseBg: "bg-rose-400" },
    { label: "待确认笔数", value: kpi.pendingCount, icon: Clock, color: "text-amber-400", pulse: false, pulseBg: "bg-amber-400" },
    { label: "退回补材料笔数", value: kpi.returnedCount, icon: RotateCcw, color: "text-rose-400", pulse: false, pulseBg: "bg-rose-400" },
  ]

  return (
    <div className="bg-[#0f1219] min-h-screen p-6 space-y-6">
      <FilterPanel />

      <div className="grid grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-[#13161f] border border-zinc-800/60 rounded-xl px-5 py-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{card.label}</span>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-2xl font-bold ${card.color}`}>{card.value}</span>
              {card.pulse && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${card.pulseBg} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${card.pulseBg}`} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">归集趋势折线图</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={DAILY_TREND_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 12 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "#1c1f2e", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {BANKS.map((bank) => (
                <Line key={bank} type="monotone" dataKey={bank} stroke={BANK_COLORS[bank]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">限额使用率横向柱状图</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={limitUsageData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 12 }} unit="%" />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1c1f2e", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(v: number) => `${v}%`}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                {limitUsageData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.rate > 80 ? "#f43f5e" : "#38bdf8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">异常预警</h3>
        <div className="space-y-2">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity]
            return (
              <div
                key={alert.id}
                onClick={() => navigate("/details")}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors border-l-4 ${style.border}`}
              >
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                  {ALERT_LABELS[alert.type]}
                </span>
                <span className="text-sm text-zinc-300 flex-1">{alert.message}</span>
                <span className="text-xs text-zinc-600 font-mono">{new Date(alert.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
