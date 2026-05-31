import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { STATUS_LABELS, ANOMALY_LABELS } from "@/types"
import { ChevronRight, Battery, Clock, MapPin, AlertTriangle } from "lucide-react"
import { useMemo } from "react"
import type { PVRoute } from "@/types"

const statusStyles: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  normal: { border: "border-l-accent-green", bg: "bg-accent-green/5", text: "text-accent-green", dot: "bg-accent-green" },
  pending: { border: "border-l-accent-amber", bg: "bg-accent-amber/5", text: "text-accent-amber", dot: "bg-accent-amber" },
  abnormal: { border: "border-l-accent-red", bg: "bg-accent-red/5", text: "text-accent-red", dot: "bg-accent-red" },
}

function RouteRow({ route, index }: { route: PVRoute; index: number }) {
  const navigate = useNavigate()
  const anomalies = useStore((s) => s.anomalies)
  const routeAnomalies = useMemo(() => anomalies.filter((a) => a.routeId === route.id), [anomalies, route.id])
  const style = statusStyles[route.status]

  return (
    <button
      onClick={() => navigate(`/route/${route.id}`)}
      className={`animate-slide-up stagger-${Math.min(index + 1, 6)} w-full group flex items-center gap-4 px-5 py-4 bg-surface-700/50 border border-surface-500/20 border-l-4 ${style.border} rounded-lg hover:bg-surface-600/50 hover:border-surface-400/40 transition-all duration-200 cursor-pointer text-left`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1.5">
          <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
            {route.name}
          </h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {STATUS_LABELS[route.status]}
          </span>
          {routeAnomalies.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-surface-500/30 text-slate-400">
              <AlertTriangle size={10} />
              {routeAnomalies.length}条异常
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="font-mono">{route.id}</span>
          <span>{route.date}</span>
          <span className="flex items-center gap-1">
            <Battery size={10} />
            {route.batteryCycles}次
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {route.flightDuration}min
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={10} />
            {route.noFlyZoneDistance}m
          </span>
        </div>
      </div>

      {routeAnomalies.length > 0 && (
        <div className="flex items-center gap-1.5">
          {routeAnomalies.map((a) => (
            <span
              key={a.id}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                a.type === "battery_cycle_error"
                  ? "bg-accent-amber/10 text-accent-amber"
                  : a.type === "return_point_lost"
                  ? "bg-accent-red/10 text-accent-red"
                  : "bg-orange-500/10 text-orange-400"
              }`}
            >
              {ANOMALY_LABELS[a.type]}
            </span>
          ))}
        </div>
      )}

      <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
    </button>
  )
}

export default function RouteList() {
  const routes = useStore((s) => s.routes)
  const anomalies = useStore((s) => s.anomalies)
  const filters = useStore((s) => s.filters)

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      if (filters.statusFilter.length > 0 && !filters.statusFilter.includes(route.status)) return false
      if (filters.anomalyTypeFilter.length > 0) {
        const routeAnomalies = anomalies.filter((a) => a.routeId === route.id)
        if (!routeAnomalies.some((a) => filters.anomalyTypeFilter.includes(a.type))) return false
      }
      if (filters.dateRange.start && route.date < filters.dateRange.start) return false
      if (filters.dateRange.end && route.date > filters.dateRange.end) return false
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        if (!route.name.toLowerCase().includes(q) && !route.id.toLowerCase().includes(q) && !route.pilot.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [routes, anomalies, filters])

  if (filteredRoutes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <MapPin size={40} className="mb-3 opacity-30" />
        <p className="text-sm">未找到匹配的航线</p>
        <p className="text-xs mt-1">尝试调整筛选条件</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {filteredRoutes.map((route, i) => (
        <RouteRow key={route.id} route={route} index={i} />
      ))}
    </div>
  )
}
