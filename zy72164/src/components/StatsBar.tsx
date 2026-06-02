import { useMemo } from "react"
import { MapPin, CheckCircle, Clock, Eye } from "lucide-react"
import { useAlertStore } from "@/store/alertStore"

const statusConfig = [
  { key: "total" as const, label: "预警总数", color: "#4a90d9", Icon: MapPin },
  { key: "processed" as const, label: "已处理", color: "#10b981", Icon: CheckCircle },
  { key: "pending" as const, label: "待核实", color: "#f59e0b", Icon: Clock },
  { key: "recheck" as const, label: "需复看", color: "#ef4444", Icon: Eye },
]

export default function StatsBar() {
  const alerts = useAlertStore((s) => s.alerts)

  const stats = useMemo(() => ({
    total: alerts.length,
    processed: alerts.filter((a) => a.status === "processed").length,
    pending: alerts.filter((a) => a.status === "pending").length,
    recheck: alerts.filter((a) => a.status === "recheck").length,
  }), [alerts])

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border-b border-white/10">
      {statusConfig.map(({ key, label, color, Icon }) => (
        <div
          key={key}
          className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 min-w-[160px]"
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon size={18} style={{ color }} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-400">{label}</span>
            <span className="font-mono text-lg font-bold text-white">
              {stats[key]}
            </span>
          </div>
          <div
            className="w-1 self-stretch rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      ))}
    </div>
  )
}
