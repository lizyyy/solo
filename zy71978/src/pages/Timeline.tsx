import { useStore } from "@/store"
import { SOURCE_LABELS, STATUS_LABELS, STATUS_COLORS, SOURCE_COLORS } from "@/types"
import type { RecordSource, RecordStatus } from "@/types"
import { Rocket, ClipboardCheck, Headphones, AlertTriangle, Copy, Clock } from "lucide-react"

const sourceIcons: Record<RecordSource, React.ReactNode> = {
  grayscale: <Rocket size={14} className="text-amber-500" />,
  quality_check: <ClipboardCheck size={14} className="text-emerald-500" />,
  customer_service: <Headphones size={14} className="text-sky-400" />,
}

const sourceDots: Record<RecordSource, string> = {
  grayscale: "bg-amber-500",
  quality_check: "bg-emerald-500",
  customer_service: "bg-sky-400",
}

function formatDate(ts: string) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export default function TimelinePage() {
  const { sourceFilter, statusFilter, toggleSourceFilter, toggleStatusFilter, clearFilters, filteredTimeline } = useStore()
  const records = filteredTimeline()

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-800">统一时间线</h2>
        <p className="text-sm text-slate-500 mt-1">灰度记录 · 质检表 · 客服对话 — 同一条线里看</p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">来源</span>
        {(["grayscale", "quality_check", "customer_service"] as RecordSource[]).map((s) => (
          <button
            key={s}
            onClick={() => toggleSourceFilter(s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
              sourceFilter.includes(s)
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {sourceIcons[s]}
            {SOURCE_LABELS[s]}
          </button>
        ))}
        <span className="text-slate-200 mx-1">|</span>
        <span className="text-xs text-slate-400 font-medium">状态</span>
        {(["confirmed", "pending", "manual_corrected"] as RecordStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => toggleStatusFilter(s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
              statusFilter.includes(s)
                ? STATUS_COLORS[s] + " border"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        {(sourceFilter.length > 0 || statusFilter.length > 0) && (
          <button onClick={clearFilters} className="text-xs text-amber-600 hover:text-amber-700 ml-2">
            清除筛选
          </button>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-[72px] top-0 bottom-0 w-px bg-slate-200" />

        {records.map((record) => (
          <div key={record.id} className="relative flex gap-4 mb-6 group">
            <div className="w-[144px] shrink-0 text-right pt-1">
              <span className="text-xs text-slate-400 font-mono">{formatDate(record.timestamp)}</span>
            </div>
            <div className="relative z-10 mt-1.5">
              <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${sourceDots[record.source]}`} />
            </div>
            <div className={`flex-1 bg-white rounded-lg border border-slate-200 border-l-[3px] ${SOURCE_COLORS[record.source]} p-4 shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    {sourceIcons[record.source]}
                    <span className="text-xs text-slate-400">{SOURCE_LABELS[record.source]}</span>
                    {record.isLateAttachment && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        <Clock size={10} /> 晚到附件
                      </span>
                    )}
                    {record.isDuplicate && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        <Copy size={10} /> 重复项
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-slate-800">{record.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{record.summary}</p>
                  {record.pendingReason && (
                    <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {record.pendingReason}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2.5">
                    {record.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[record.status]}`}>
                  {STATUS_LABELS[record.status]}
                </span>
              </div>
            </div>
          </div>
        ))}

        {records.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400">
            当前筛选条件下无记录
          </div>
        )}
      </div>
    </div>
  )
}
