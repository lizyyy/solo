import { useState, useMemo } from "react"
import { Filter, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { useAlertStore } from "@/store/alertStore"
import type { AlertStatus, SourceType } from "@/types/alert"

const statusOptions: { value: AlertStatus; label: string; color: string }[] = [
  { value: "processed", label: "已处理", color: "#10b981" },
  { value: "pending", label: "待核实", color: "#f59e0b" },
  { value: "recheck", label: "需复看", color: "#ef4444" },
]

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: "inspection_report", label: "巡检报告" },
  { value: "inspection_photo", label: "巡检照片" },
  { value: "complaint", label: "市民投诉" },
  { value: "statistics", label: "统计数据" },
]

export default function FilterPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const filter = useAlertStore((s) => s.filter)
  const setFilter = useAlertStore((s) => s.setFilter)
  const alerts = useAlertStore((s) => s.alerts)

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filter.status !== "all" && a.status !== filter.status) return false
      if (filter.sourceType !== "all" && a.sourceType !== filter.sourceType) return false
      return true
    })
  }, [alerts, filter])

  const duplicateAlerts = useMemo(
    () => filteredAlerts.filter((a) => a.duplicateComplaintIds.length > 0),
    [filteredAlerts]
  )

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const opt of statusOptions) {
      counts[opt.value] = alerts.filter(
        (a) =>
          a.status === opt.value &&
          (filter.sourceType === "all" || a.sourceType === filter.sourceType)
      ).length
    }
    return counts
  }, [alerts, filter.sourceType])

  function toggleStatus(value: AlertStatus) {
    const current = filter.status
    if (current === value) {
      setFilter({ ...filter, status: "all" })
    } else if (current === "all") {
      setFilter({ ...filter, status: value })
    } else {
      setFilter({ ...filter, status: "all" })
    }
  }

  function toggleSource(value: SourceType) {
    const current = filter.sourceType
    if (current === value) {
      setFilter({ ...filter, sourceType: "all" })
    } else if (current === "all") {
      setFilter({ ...filter, sourceType: value })
    } else {
      setFilter({ ...filter, sourceType: "all" })
    }
  }

  return (
    <div
      className={`flex flex-col bg-[#1a1a2e] border-r border-white/10 transition-all duration-300 ${
        collapsed ? "w-10" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2 text-white">
            <Filter size={16} />
            <span className="text-sm font-medium">筛选条件</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              状态筛选
            </h3>
            <div className="space-y-1">
              {statusOptions.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => toggleStatus(value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter.status === value
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full border-2"
                    style={{
                      borderColor: color,
                      backgroundColor:
                        filter.status === value ? color : "transparent",
                    }}
                  />
                  <span>{label}</span>
                  <span className="ml-auto font-mono text-xs text-gray-500">
                    {(filter.status === value || filter.status === "all")
                      ? `(${statusCounts[value]})`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
              来源类型
            </h3>
            <div className="space-y-1">
              {sourceOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleSource(value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    filter.sourceType === value
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-sm border-2"
                    style={{
                      borderColor: "#4a90d9",
                      backgroundColor:
                        filter.sourceType === value ? "#4a90d9" : "transparent",
                    }}
                  />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {duplicateAlerts.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                同名路口预警
              </h3>
              <div className="space-y-2">
                {duplicateAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-yellow-900/20 border border-yellow-700/30"
                  >
                    <AlertTriangle
                      size={14}
                      className="text-yellow-500 mt-0.5 shrink-0"
                    />
                    <div className="text-xs">
                      <p className="text-yellow-200">{alert.name}</p>
                      <p className="text-yellow-500/70 font-mono">
                        {alert.duplicateComplaintIds.length} 条关联
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
