import { FileText, CheckCircle, Clock, AlertTriangle, MessageSquare } from "lucide-react"
import type { AlertSource, ProcessRecord, ProcessAction } from "@/types/alert"

type TimelineItem =
  | { kind: "source"; data: AlertSource }
  | { kind: "process"; data: ProcessRecord }

const actionConfig: Record<ProcessAction, { label: string; icon: React.ReactNode; color: string; borderColor: string }> = {
  confirmed: { label: "确认已处理", icon: <CheckCircle size={14} />, color: "#10b981", borderColor: "#10b981" },
  marked_pending: { label: "标记待核实", icon: <Clock size={14} />, color: "#f59e0b", borderColor: "#f59e0b" },
  marked_recheck: { label: "标记需现场复看", icon: <AlertTriangle size={14} />, color: "#ef4444", borderColor: "#ef4444" },
  opinion_added: { label: "添加意见", icon: <MessageSquare size={14} />, color: "#4a90d9", borderColor: "#4a90d9" },
}

const sourceTypeLabel: Record<string, string> = {
  inspection_report: "巡检报告",
  inspection_photo: "巡检照片",
  complaint: "市民投诉",
  statistics: "统计数据",
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function SourceNode({ data }: { data: AlertSource }) {
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-[#1a1a2e] border-2 border-[#4a90d9] flex items-center justify-center shrink-0">
          <FileText size={12} className="text-[#4a90d9]" />
        </div>
        <div className="w-px flex-1 bg-white/10 mt-1" />
      </div>
      <div className="flex-1 pb-5 border-l-2 border-[#4a90d9] pl-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-500">{formatTime(data.recordedAt)}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#4a90d9]/20 text-[#4a90d9]">{sourceTypeLabel[data.type]}</span>
        </div>
        <p className="text-sm text-[#4a90d9] font-medium mb-0.5">{data.referenceNo}</p>
        <p className="text-xs text-gray-400 leading-relaxed">{data.description}</p>
      </div>
    </div>
  )
}

function ProcessNode({ data }: { data: ProcessRecord }) {
  const config = actionConfig[data.action]
  const overridden = data.isOverridden

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: overridden ? "#eab308" : config.color, backgroundColor: overridden ? "rgba(234,179,8,0.1)" : "transparent" }}
        >
          {config.icon}
        </div>
        <div className="w-px flex-1 bg-white/10 mt-1" />
      </div>
      <div
        className="flex-1 pb-5 pl-4 border-l-2"
        style={{ borderColor: overridden ? "#eab308" : config.borderColor }}
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-mono text-gray-500">{formatTime(data.processedAt)}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${config.color}20`, color: config.color }}>
            {config.label}
          </span>
          {overridden && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#eab308]/20 text-[#eab308] font-medium">
              已被新方案覆盖
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-xs text-gray-300">{data.operator}</span>
        </div>
        {data.opinion && (
          <p className={`text-xs leading-relaxed ${overridden ? "text-gray-500 line-through" : "text-gray-400"}`}>
            {data.opinion}
          </p>
        )}
        {overridden && data.overriddenBy && (
          <p className="text-[10px] text-[#eab308]/70 mt-1">被记录 {data.overriddenBy} 替代</p>
        )}
      </div>
    </div>
  )
}

export default function Timeline({ sources, processRecords }: { sources: AlertSource[]; processRecords: ProcessRecord[] }) {
  const items: TimelineItem[] = [
    ...sources.map((s) => ({ kind: "source" as const, data: s })),
    ...processRecords.map((p) => ({ kind: "process" as const, data: p })),
  ]

  items.sort((a, b) => {
    const ta = a.kind === "source" ? new Date(a.data.recordedAt).getTime() : new Date(a.data.processedAt).getTime()
    const tb = b.kind === "source" ? new Date(b.data.recordedAt).getTime() : new Date(b.data.processedAt).getTime()
    return ta - tb
  })

  return (
    <div className="space-y-0">
      {items.map((item) =>
        item.kind === "source" ? (
          <SourceNode key={item.data.id} data={item.data} />
        ) : (
          <ProcessNode key={item.data.id} data={item.data} />
        )
      )}
    </div>
  )
}
