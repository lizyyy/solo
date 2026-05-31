import { useEffect } from "react"
import { useInspectionStore } from "@/store/useInspectionStore"
import TimelineCard from "@/components/TimelineCard"
import StatusBadge from "@/components/StatusBadge"
import { EVENT_TYPE_LABELS } from "@/types"
import { cn } from "@/lib/utils"
import { Activity, Filter } from "lucide-react"
import { useState } from "react"

type TypeFilter = "all" | "condition" | "threshold" | "maintenance"

export default function TimelinePage() {
  const { loadMockData, dataLoaded, getTimelineEvents, selectedEventId, conditionLogs, thresholdEvents, maintenanceOrders } = useInspectionStore()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")

  useEffect(() => {
    if (!dataLoaded) loadMockData()
  }, [dataLoaded, loadMockData])

  const allEvents = getTimelineEvents()
  const events = typeFilter === "all" ? allEvents : allEvents.filter((e) => e.type === typeFilter)

  const confirmedCount = [...conditionLogs, ...thresholdEvents, ...maintenanceOrders].filter((r) => r.status === "confirmed").length
  const pendingCount = [...conditionLogs, ...thresholdEvents, ...maintenanceOrders].filter((r) => r.status === "pending").length
  const correctedCount = [...conditionLogs, ...thresholdEvents, ...maintenanceOrders].filter((r) => r.status === "manual_corrected").length

  const filterOptions: { value: TypeFilter; label: string; color: string }[] = [
    { value: "all", label: "全部", color: "bg-slate-800 text-white" },
    { value: "condition", label: "工况日志", color: "bg-blue-100 text-blue-700" },
    { value: "threshold", label: "阈值触发", color: "bg-amber-100 text-amber-700" },
    { value: "maintenance", label: "维修单", color: "bg-red-100 text-red-700" },
  ]

  return (
    <div className="h-full">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-slate-700" />
            <h1 className="text-lg font-semibold text-slate-800">巡检时间线</h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              设备 P-101
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <StatusBadge status="confirmed" compact /> <span className="text-slate-500">{confirmedCount}</span>
            <StatusBadge status="pending" compact /> <span className="text-slate-500">{pendingCount}</span>
            <StatusBadge status="manual_corrected" compact /> <span className="text-slate-500">{correctedCount}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">筛选：</span>
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === opt.value ? opt.color : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {opt.label}
              {opt.value !== "all" && (
                <span className="ml-1">
                  ({allEvents.filter((e) => e.type === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-6 py-6">
        {events.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">暂无时间线事件</div>
        ) : (
          events.map((event, i) => (
            <TimelineCard
              key={event.data.id}
              event={event}
              isSelected={selectedEventId === event.data.id}
              isLast={i === events.length - 1}
            />
          ))
        )}
      </div>
    </div>
  )
}
