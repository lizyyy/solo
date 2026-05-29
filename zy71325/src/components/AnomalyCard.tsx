import type { AnomalyFragment, AnomalyType } from "@/types"
import { ANOMALY_TYPE_LABELS, ANOMALY_COLORS } from "@/types"
import { AlertTriangle, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface Props {
  anomaly: AnomalyFragment
  onUpdate: (id: string, updates: Partial<AnomalyFragment>) => void
  trackName?: string
}

export default function AnomalyCard({ anomaly, onUpdate, trackName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState(anomaly.note)

  const color = ANOMALY_COLORS[anomaly.type]
  const Icon = anomaly.severity === "error" ? AlertCircle : AlertTriangle

  return (
    <div
      className="rounded-lg border bg-[#12122A] overflow-hidden transition-all"
      style={{ borderColor: `${color}40` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-[#1A1A35] transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {ANOMALY_TYPE_LABELS[anomaly.type]}
            </span>
            <span className="text-xs text-gray-500">
              {anomaly.severity === "error" ? "严重" : "警告"}
            </span>
            {trackName && (
              <span className="text-xs text-gray-600 truncate">{trackName}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 truncate">
            {anomaly.startTime.toFixed(1)}s — {anomaly.endTime.toFixed(1)}s
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {anomaly.resolved && (
            <CheckCircle size={14} className="text-emerald-400" />
          )}
          {expanded ? (
            <ChevronUp size={14} className="text-gray-500" />
          ) : (
            <ChevronDown size={14} className="text-gray-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#2A2A4A]">
          <p className="text-xs text-gray-300 mb-3">{anomaly.note}</p>

          <label className="text-xs text-gray-500 mb-1 block">备注</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => onUpdate(anomaly.id, { note })}
            rows={2}
            className="w-full bg-[#0F0F1A] border border-[#2A2A4A] rounded-md px-3 py-2 text-xs text-gray-300 resize-none focus:outline-none focus:border-amber-500/50 mb-3"
            placeholder="添加处理备注..."
          />

          <div className="flex gap-2">
            <button
              onClick={() => onUpdate(anomaly.id, { resolved: !anomaly.resolved })}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                anomaly.resolved
                  ? "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
              }`}
            >
              {anomaly.resolved ? "标记待处理" : "标记已处理"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
