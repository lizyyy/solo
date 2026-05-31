import type { TimelineEvent, RecordStatus, HandlingTag } from "@/types"
import { STATUS_LABELS, EVENT_TYPE_LABELS, HANDLING_TAG_LABELS } from "@/types"
import { useInspectionStore } from "@/store/useInspectionStore"
import StatusBadge from "./StatusBadge"
import HandlingTagBadge from "./HandlingTagBadge"
import { cn } from "@/lib/utils"

function getTimestamp(event: TimelineEvent): string {
  return event.type === "maintenance" ? event.data.createdAt : event.data.timestamp
}

interface ReportGroupProps {
  title: string
  status: RecordStatus
  events: TimelineEvent[]
}

function ReportGroup({ title, status, events }: ReportGroupProps) {
  const { handlingTags, setHandlingTag } = useInspectionStore()

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">0 条</span>
        </div>
        <p className="text-sm text-slate-400">暂无记录</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <StatusBadge status={status} />
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          {events.length} 条
        </span>
      </div>
      <div className="space-y-2">
        {events.map((event) => {
          const tag = handlingTags[event.data.id] ?? "continue_observe"
          return (
            <div
              key={event.data.id}
              className="flex items-start justify-between gap-3 rounded border border-slate-100 bg-slate-50/50 p-3"
            >
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-medium",
                    event.type === "condition" ? "bg-blue-100 text-blue-700" :
                    event.type === "threshold" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {EVENT_TYPE_LABELS[event.type]}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{event.data.id}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(getTimestamp(event)).toLocaleString("zh-CN")}
                  </span>
                </div>
                {event.type === "condition" && (
                  <p className="text-sm text-slate-700">
                    振动值 {event.data.vibrationValue} {event.data.unit}（{event.data.equipmentId}）
                  </p>
                )}
                {event.type === "threshold" && (
                  <p className="text-sm text-slate-700">
                    实际值 {event.data.actualValue}，{event.data.level === "alarm" ? "报警" : "预警"}
                  </p>
                )}
                {event.type === "maintenance" && (
                  <p className="text-sm text-slate-700">{event.data.faultDesc}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <HandlingTagBadge tag={tag} />
                <select
                  value={tag}
                  onChange={(e) => setHandlingTag(event.data.id, e.target.value as HandlingTag)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-slate-400"
                >
                  {(Object.keys(HANDLING_TAG_LABELS) as HandlingTag[]).map((t) => (
                    <option key={t} value={t}>{HANDLING_TAG_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ReportSection() {
  const { getTimelineEvents } = useInspectionStore()
  const events = getTimelineEvents()

  const confirmed = events.filter((e) => e.data.status === "confirmed")
  const pending = events.filter((e) => e.data.status === "pending")
  const corrected = events.filter((e) => e.data.status === "manual_corrected")

  return (
    <div className="space-y-4">
      <ReportGroup title="已确认记录" status="confirmed" events={confirmed} />
      <ReportGroup title="待补记录" status="pending" events={pending} />
      <ReportGroup title="人工改过记录" status="manual_corrected" events={corrected} />
    </div>
  )
}
