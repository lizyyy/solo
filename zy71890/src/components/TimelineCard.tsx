import type { TimelineEvent, RecordStatus } from "@/types"
import { EVENT_TYPE_LABELS, SEVERITY_LABELS, THRESHOLD_LEVEL_LABELS, STATUS_LABELS } from "@/types"
import { useInspectionStore } from "@/store/useInspectionStore"
import StatusBadge from "./StatusBadge"
import { cn } from "@/lib/utils"
import { Thermometer, Wrench, FileText } from "lucide-react"

const typeColors: Record<string, string> = {
  condition: "border-l-blue-500",
  threshold: "border-l-amber-500",
  maintenance: "border-l-red-500",
}

const typeBgColors: Record<string, string> = {
  condition: "bg-blue-50",
  threshold: "bg-amber-50",
  maintenance: "bg-red-50",
}

const typeIconColors: Record<string, string> = {
  condition: "text-blue-500",
  threshold: "text-amber-500",
  maintenance: "text-red-500",
}

function EventIcon({ type }: { type: TimelineEvent["type"] }) {
  if (type === "condition") return <FileText className={cn("h-4 w-4", typeIconColors[type])} />
  if (type === "threshold") return <Thermometer className={cn("h-4 w-4", typeIconColors[type])} />
  return <Wrench className={cn("h-4 w-4", typeIconColors[type])} />
}

function getTimestamp(event: TimelineEvent): string {
  return event.type === "maintenance" ? event.data.createdAt : event.data.timestamp
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatDate(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function EventSummary({ event }: { event: TimelineEvent }) {
  if (event.type === "condition") {
    return (
      <span>
        振动值 <span className="font-mono font-semibold text-blue-700">{event.data.vibrationValue}</span>{" "}
        {event.data.unit}（{event.data.equipmentId}）
      </span>
    )
  }
  if (event.type === "threshold") {
    return (
      <span>
        {THRESHOLD_LEVEL_LABELS[event.data.level]}：实际{" "}
        <span className="font-mono font-semibold text-amber-700">{event.data.actualValue}</span>{" "}
        {event.type === "threshold" ? "mm/s" : ""}
      </span>
    )
  }
  return (
    <span>
      <span className={cn(
        "mr-1 rounded px-1 py-0.5 text-xs font-medium",
        event.data.severity === "critical" ? "bg-red-200 text-red-900" :
        event.data.severity === "major" ? "bg-orange-200 text-orange-900" :
        "bg-slate-200 text-slate-700"
      )}>
        {SEVERITY_LABELS[event.data.severity]}
      </span>
      {event.data.faultDesc}
    </span>
  )
}

interface TimelineCardProps {
  event: TimelineEvent
  isSelected: boolean
  isLast: boolean
}

export default function TimelineCard({ event, isSelected, isLast }: TimelineCardProps) {
  const { selectEvent, setRecordStatus } = useInspectionStore()
  const timestamp = getTimestamp(event)

  return (
    <div className="flex gap-4">
      <div className="flex w-24 flex-shrink-0 flex-col items-end pt-1.5">
        <span className="text-sm font-medium text-slate-600">{formatTime(timestamp)}</span>
        <span className="text-xs text-slate-400">{formatDate(timestamp)}</span>
      </div>
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white",
            typeBgColors[event.type],
            isSelected ? "border-slate-800 ring-2 ring-slate-300" : "border-slate-200"
          )}
        >
          <EventIcon type={event.type} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-200" />}
      </div>
      <div
        className={cn(
          "mb-3 flex-1 cursor-pointer rounded-md border-l-4 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
          typeColors[event.type],
          isSelected && "ring-2 ring-slate-300"
        )}
        onClick={() => selectEvent(isSelected ? null : event.data.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                typeBgColors[event.type],
                event.type === "condition" ? "text-blue-700" :
                event.type === "threshold" ? "text-amber-700" : "text-red-700"
              )}>
                {EVENT_TYPE_LABELS[event.type]}
              </span>
              <EventSummary event={event} />
            </div>
          </div>
          <StatusBadge status={event.data.status as RecordStatus} compact />
        </div>
        {isSelected && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <EventDetail event={event} />
          </div>
        )}
        {isSelected && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">标记为：</span>
            {(["confirmed", "pending", "manual_corrected"] as RecordStatus[]).map((s) => (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation()
                  setRecordStatus(event.type, event.data.id, s)
                }}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  event.data.status === s
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EventDetail({ event }: { event: TimelineEvent }) {
  if (event.type === "condition") {
    const d = event.data
    return (
      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>设备编号</span><span className="font-mono font-medium text-slate-800">{d.equipmentId}</span>
        </div>
        <div className="flex justify-between">
          <span>振动值</span><span className="font-mono font-medium text-slate-800">{d.vibrationValue} {d.unit}</span>
        </div>
        <div className="flex justify-between">
          <span>记录时间</span><span className="font-mono font-medium text-slate-800">{new Date(d.timestamp).toLocaleString("zh-CN")}</span>
        </div>
        {d.correctionNote && (
          <div className="rounded bg-violet-50 p-2 text-violet-700">
            修正说明：{d.correctionNote}
          </div>
        )}
        {d.attachments.length > 0 && (
          <div>
            <span className="text-slate-500">附件：</span>
            {d.attachments.map((att) => (
              <span key={att.id} className={cn("ml-2", att.isLate && "text-amber-600 underline decoration-amber-400")}>
                {att.fileName}
                {att.isLate && <span className="ml-1 text-amber-500">(晚到)</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (event.type === "threshold") {
    const d = event.data
    const store = useInspectionStore.getState()
    const config = store.thresholdConfigs.find((c) => c.id === d.thresholdId)
    return (
      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>参数名称</span><span className="font-medium text-slate-800">{config?.parameterName ?? d.thresholdId}</span>
        </div>
        <div className="flex justify-between">
          <span>实际值</span><span className="font-mono font-medium text-slate-800">{d.actualValue} {config?.unit ?? ""}</span>
        </div>
        <div className="flex justify-between">
          <span>触发级别</span>
          <span className={cn("font-medium", d.level === "alarm" ? "text-red-600" : "text-amber-600")}>
            {THRESHOLD_LEVEL_LABELS[d.level]}
          </span>
        </div>
        <div className="flex justify-between">
          <span>预警阈值</span><span className="font-mono text-slate-800">{config?.warningThreshold ?? "-"} {config?.unit ?? ""}</span>
        </div>
        <div className="flex justify-between">
          <span>报警阈值</span><span className="font-mono text-slate-800">{config?.alarmThreshold ?? "-"} {config?.unit ?? ""}</span>
        </div>
      </div>
    )
  }
  const d = event.data
  return (
    <div className="space-y-1.5 text-xs text-slate-600">
      <div className="flex justify-between">
        <span>设备编号</span><span className="font-mono font-medium text-slate-800">{d.equipmentId}</span>
      </div>
      <div className="flex justify-between">
        <span>故障描述</span><span className="font-medium text-slate-800">{d.faultDesc}</span>
      </div>
      <div className="flex justify-between">
        <span>严重程度</span>
        <span className={cn("font-medium", d.severity === "critical" ? "text-red-600" : d.severity === "major" ? "text-orange-600" : "text-slate-700")}>
          {SEVERITY_LABELS[d.severity]}
        </span>
      </div>
      {d.attachments.length > 0 && (
        <div>
          <span className="text-slate-500">附件：</span>
          {d.attachments.map((att) => (
            <span key={att.id} className={cn("ml-2", att.isLate && "text-amber-600 underline decoration-amber-400")}>
              {att.fileName}
              {att.isLate && <span className="ml-1 text-amber-500">(晚到)</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
