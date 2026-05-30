import { Camera, Clock } from "lucide-react"
import { useFilterStore } from "@/stores/useFilterStore"
import { useAuditStore } from "@/stores/useAuditStore"
import { captureFullPageScreenshot } from "@/utils/screenshot"
import { EXPIRY_BUCKETS } from "@/data/mockData"

interface ToolbarProps {
  auditOpen: boolean
  onToggleAudit: () => void
}

const GREEK_LABELS: Record<string, string> = {
  delta: "Δ",
  gamma: "Γ",
  vega: "ν",
}

export default function Toolbar({ auditOpen, onToggleAudit }: ToolbarProps) {
  const { activeGreeks, activeBuckets, thresholdValue } = useFilterStore()
  const logAction = useAuditStore((s) => s.logAction)

  function handleScreenshot() {
    captureFullPageScreenshot()
    logAction("SCREENSHOT", "截取全页面截图")
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-gray-800 bg-[#0d1117] px-4">
      <h1 className="text-sm font-semibold text-gray-200 whitespace-nowrap">期权敞口风险塔</h1>

      <div className="h-5 w-px bg-gray-700" />

      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {activeGreeks.map((g) => (
          <span
            key={g}
            className="shrink-0 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400 border border-cyan-500/20"
          >
            {GREEK_LABELS[g]} {g}
          </span>
        ))}
        {activeBuckets.map((bId) => {
          const bucket = EXPIRY_BUCKETS.find((b) => b.id === bId)
          if (!bucket) return null
          return (
            <span
              key={bId}
              className="shrink-0 flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: bucket.color }}
              />
              {bucket.label}
            </span>
          )
        })}
        {thresholdValue > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 border border-amber-500/20">
            阈值 {thresholdValue}
          </span>
        )}
      </div>

      <div className="h-5 w-px bg-gray-700" />

      <button
        onClick={handleScreenshot}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-300 transition-colors"
        title="截图"
      >
        <Camera className="h-4 w-4" />
      </button>

      <button
        onClick={onToggleAudit}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
          auditOpen
            ? "bg-cyan-500/10 text-cyan-400"
            : "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
        }`}
        title="审计时间线"
      >
        <Clock className="h-4 w-4" />
      </button>
    </header>
  )
}
