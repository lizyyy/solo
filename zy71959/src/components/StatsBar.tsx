import { useStore } from "@/store/useStore"
import { STATUS_LABELS } from "@/types"
import { CheckCircle, AlertTriangle, XCircle, MapPin } from "lucide-react"
import { useMemo } from "react"
import type { RouteStatus } from "@/types"

export default function StatsBar() {
  const routes = useStore((s) => s.routes)
  const setFilters = useStore((s) => s.setFilters)

  const stats = useMemo(() => ({
    total: routes.length,
    normal: routes.filter((r) => r.status === "normal").length,
    pending: routes.filter((r) => r.status === "pending").length,
    abnormal: routes.filter((r) => r.status === "abnormal").length,
  }), [routes])

  const cards: { key: RouteStatus | "total"; label: string; value: number; icon: React.ReactNode; color: string; bgColor: string; filterValue?: RouteStatus[] }[] = [
    {
      key: "total",
      label: "总航线",
      value: stats.total,
      icon: <MapPin size={20} />,
      color: "text-accent-blue",
      bgColor: "from-accent-blue/20 to-accent-blue/5",
    },
    {
      key: "normal",
      label: STATUS_LABELS.normal,
      value: stats.normal,
      icon: <CheckCircle size={20} />,
      color: "text-accent-green",
      bgColor: "from-accent-green/20 to-accent-green/5",
      filterValue: ["normal"],
    },
    {
      key: "pending",
      label: STATUS_LABELS.pending,
      value: stats.pending,
      icon: <AlertTriangle size={20} />,
      color: "text-accent-amber",
      bgColor: "from-accent-amber/20 to-accent-amber/5",
      filterValue: ["pending"],
    },
    {
      key: "abnormal",
      label: STATUS_LABELS.abnormal,
      value: stats.abnormal,
      icon: <XCircle size={20} />,
      color: "text-accent-red",
      bgColor: "from-accent-red/20 to-accent-red/5",
      filterValue: ["abnormal"],
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <button
          key={card.key}
          onClick={() => {
            if (card.filterValue) {
              setFilters({ statusFilter: card.filterValue })
            } else {
              setFilters({ statusFilter: [] })
            }
          }}
          className={`animate-slide-up stagger-${i + 1} group relative overflow-hidden rounded-xl bg-gradient-to-br ${card.bgColor} border border-surface-500/30 p-5 text-left transition-all duration-300 hover:border-surface-400/50 hover:scale-[1.02] active:scale-[0.98]`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">{card.label}</p>
              <p className={`text-3xl font-bold font-mono ${card.color} transition-all duration-300`}>
                {card.value}
              </p>
            </div>
            <div className={`${card.color} opacity-50 group-hover:opacity-80 transition-opacity`}>
              {card.icon}
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  )
}
