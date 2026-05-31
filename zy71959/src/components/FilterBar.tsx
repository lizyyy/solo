import { useStore } from "@/store/useStore"
import { STATUS_LABELS, ANOMALY_LABELS, type RouteStatus, type AnomalyType } from "@/types"
import { Search, X, Filter } from "lucide-react"
import { useMemo } from "react"

export default function FilterBar() {
  const filters = useStore((s) => s.filters)
  const routes = useStore((s) => s.routes)
  const setFilters = useStore((s) => s.setFilters)
  const resetFilters = useStore((s) => s.resetFilters)

  const stats = useMemo(() => ({
    normal: routes.filter((r) => r.status === "normal").length,
    pending: routes.filter((r) => r.status === "pending").length,
    abnormal: routes.filter((r) => r.status === "abnormal").length,
  }), [routes])

  const hasActiveFilters = filters.statusFilter.length > 0 || filters.anomalyTypeFilter.length > 0 || filters.searchQuery || filters.dateRange.start || filters.dateRange.end

  const toggleStatusFilter = (status: RouteStatus) => {
    const current = filters.statusFilter
    if (current.includes(status)) {
      setFilters({ statusFilter: current.filter((s) => s !== status) })
    } else {
      setFilters({ statusFilter: [...current, status] })
    }
  }

  const toggleAnomalyFilter = (type: AnomalyType) => {
    const current = filters.anomalyTypeFilter
    if (current.includes(type)) {
      setFilters({ anomalyTypeFilter: current.filter((t) => t !== type) })
    } else {
      setFilters({ anomalyTypeFilter: [...current, type] })
    }
  }

  const statusColors: Record<RouteStatus, string> = {
    normal: "border-accent-green/50 text-accent-green bg-accent-green/10",
    pending: "border-accent-amber/50 text-accent-amber bg-accent-amber/10",
    abnormal: "border-accent-red/50 text-accent-red bg-accent-red/10",
  }

  const statusInactiveColors: Record<RouteStatus, string> = {
    normal: "border-surface-500/30 text-slate-500",
    pending: "border-surface-500/30 text-slate-500",
    abnormal: "border-surface-500/30 text-slate-500",
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜索航线名称、ID或飞手..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-700 border border-surface-500/30 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-green/50 focus:ring-1 focus:ring-accent-green/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) => setFilters({ dateRange: { ...filters.dateRange, start: e.target.value } })}
            className="px-3 py-2.5 bg-surface-700 border border-surface-500/30 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-accent-green/50 transition-all"
          />
          <span className="text-slate-500 text-xs">至</span>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) => setFilters({ dateRange: { ...filters.dateRange, end: e.target.value } })}
            className="px-3 py-2.5 bg-surface-700 border border-surface-500/30 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-accent-green/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-500" />
          <span className="text-xs text-slate-500 mr-1">状态</span>
          {(Object.keys(STATUS_LABELS) as RouteStatus[]).map((status) => {
            const isActive = filters.statusFilter.includes(status)
            return (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-all duration-200 ${
                  isActive ? statusColors[status] : statusInactiveColors[status]
                }`}
              >
                {STATUS_LABELS[status]}
                <span className="ml-1 font-mono opacity-70">
                  {status === "normal" ? stats.normal : status === "pending" ? stats.pending : stats.abnormal}
                </span>
              </button>
            )
          })}
        </div>

        <div className="w-px h-4 bg-surface-500/30" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">异常</span>
          {(Object.keys(ANOMALY_LABELS) as AnomalyType[]).map((type) => {
            const isActive = filters.anomalyTypeFilter.includes(type)
            return (
              <button
                key={type}
                onClick={() => toggleAnomalyFilter(type)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-all duration-200 ${
                  isActive
                    ? "border-accent-amber/50 text-accent-amber bg-accent-amber/10"
                    : "border-surface-500/30 text-slate-500"
                }`}
              >
                {ANOMALY_LABELS[type]}
              </button>
            )
          })}
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-accent-red hover:bg-accent-red/10 rounded-md transition-colors"
          >
            <X size={12} />
            清除筛选
          </button>
        )}
      </div>
    </div>
  )
}
