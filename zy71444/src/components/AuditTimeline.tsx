import { useAuditStore } from "@/stores/useAuditStore"
import { EXPIRY_BUCKETS } from "@/data/mockData"

interface AuditTimelineProps {
  open: boolean
  onClose: () => void
}

const GREEK_LABELS: Record<string, string> = {
  delta: "Δ",
  gamma: "Γ",
  vega: "ν",
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString("zh-CN", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0")
}

export default function AuditTimeline({ open, onClose }: AuditTimelineProps) {
  const entries = useAuditStore((s) => s.entries)
  const restoredEntryId = useAuditStore((s) => s.restoredEntryId)
  const restoreEntry = useAuditStore((s) => s.restoreEntry)

  if (!open) return null

  return (
    <div className="shrink-0 border-t border-gray-800 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          审计时间线
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          收起
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {entries.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-600">暂无操作记录</p>
        )}
        {entries.map((entry) => {
          const isRestored = entry.id === restoredEntryId
          return (
            <button
              key={entry.id}
              onClick={() => restoreEntry(entry.id)}
              className={`flex w-full items-start gap-3 border-b border-gray-800/50 px-4 py-2.5 text-left transition-colors ${
                isRestored
                  ? "bg-cyan-500/5 border-l-2 border-l-cyan-500"
                  : "hover:bg-gray-800/30 border-l-2 border-l-transparent"
              }`}
            >
              <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-gray-600">
                {formatTime(entry.timestamp)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isRestored ? "text-cyan-400" : "text-gray-300"}`}>
                    {entry.action}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500 truncate">{entry.summary}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.context.activeGreeks.map((g) => (
                    <span
                      key={g}
                      className="rounded bg-gray-800 px-1 py-0.5 text-[9px] text-gray-400"
                    >
                      {GREEK_LABELS[g]}
                    </span>
                  ))}
                  {entry.context.activeBuckets.map((bId) => {
                    const bucket = EXPIRY_BUCKETS.find((b) => b.id === bId)
                    if (!bucket) return null
                    return (
                      <span
                        key={bId}
                        className="flex items-center gap-0.5 rounded bg-gray-800 px-1 py-0.5 text-[9px] text-gray-400"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: bucket.color }}
                        />
                        {bucket.label}
                      </span>
                    )
                  })}
                  {entry.context.thresholdValue > 0 && (
                    <span className="rounded bg-amber-900/20 px-1 py-0.5 text-[9px] text-amber-400">
                      ≥{entry.context.thresholdValue}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
