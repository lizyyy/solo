import { FileText, AlertTriangle, CheckCircle, Plus } from "lucide-react"
import { useGradingStore } from "@/store/gradingStore"

export function StatsBar() {
  const records = useGradingStore((s) => s.records)

  const pendingCount = records.filter((r) => r.status === "pending").length
  const supplementaryCount = records.filter(
    (r) => r.changeType === "supplementary"
  ).length
  const conclusionChangeCount = records.filter(
    (r) => r.changeType === "conclusion_change"
  ).length
  const equivalentIssueCount = records.filter(
    (r) => r.equivalentAnswerIssue
  ).length
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCount = records.filter(
    (r) => r.createdAt.slice(0, 10) === todayStr
  ).length

  const stats = [
    {
      icon: AlertTriangle,
      label: "待处理",
      value: pendingCount,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      icon: FileText,
      label: "补材料 / 改结论",
      value: `${supplementaryCount} / ${conclusionChangeCount}`,
      color: "text-navy-600",
      bg: "bg-navy-50",
    },
    {
      icon: CheckCircle,
      label: "等价答案误判",
      value: equivalentIssueCount,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      icon: Plus,
      label: "今日新增",
      value: todayCount,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`flex items-center gap-3 rounded-lg border border-slate-200 ${s.bg} p-3`}
        >
          <s.icon size={20} className={s.color} />
          <div>
            <div className={`font-mono text-lg font-semibold ${s.color}`}>
              {s.value}
            </div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
