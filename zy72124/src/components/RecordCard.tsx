import type { MooringRecord } from "@/types"
import { StatusBadge } from "./StatusBadge"
import { Clock, Database, FileText } from "lucide-react"

interface RecordCardProps {
  record: MooringRecord
  isSelected: boolean
  onClick: () => void
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: "手动录入", color: "text-sky-400" },
  sensor_log: { label: "传感器日志", color: "text-violet-400" },
  legacy_supplement: { label: "旧口径补录", color: "text-orange-400" },
}

export function RecordCard({ record, isSelected, onClick }: RecordCardProps) {
  const srcConfig = SOURCE_LABELS[record.source]

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-all duration-200 cursor-pointer group ${
        isSelected
          ? "border-[#FF6B35]/60 bg-[#FF6B35]/5 shadow-lg shadow-[#FF6B35]/5"
          : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 hover:bg-slate-800/60"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-slate-300 font-semibold">{record.id}</span>
        <StatusBadge status={record.judgment.status} />
      </div>
      <div className="text-base font-medium text-slate-100 mb-2">{record.label}</div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className={`flex items-center gap-1 ${srcConfig.color}`}>
          <Database className="w-3 h-3" />
          {srcConfig.label}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(record.timestamp).toLocaleString("zh-CN")}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
        <FileText className="w-3 h-3" />
        <span className="truncate">{record.sourceNote}</span>
      </div>
    </button>
  )
}
