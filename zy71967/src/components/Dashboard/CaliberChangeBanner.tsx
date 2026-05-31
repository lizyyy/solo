import { AlertTriangle } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { SOURCE_LABELS } from "@/types"

export default function CaliberChangeBanner() {
  const getCaliberChangedMetrics = useAppStore((s) => s.getCaliberChangedMetrics)
  const changedMetrics = getCaliberChangedMetrics()

  if (changedMetrics.length === 0) return null

  const sources = [...new Set(changedMetrics.map((m) => m.caliberChangeSource).filter(Boolean))]
  const sourceLabels = sources
    .map((s) => SOURCE_LABELS[s as keyof typeof SOURCE_LABELS])
    .join(" / ")

  const nextSteps = changedMetrics
    .map((m) => m.caliberChangeNextStep)
    .filter(Boolean) as string[]

  return (
    <div
      className={cn(
        "rounded-md border border-amber-500/30",
        "bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(245,158,11,0.05)_10px,rgba(245,158,11,0.05)_20px)]"
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-amber-400">口径变更提醒</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-mono text-amber-300">
              {changedMetrics.length} 项
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            口径变更来源：{sourceLabels}
          </p>
          {nextSteps.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {nextSteps.map((step, i) => (
                <p key={i} className="text-xs text-slate-400">
                  下一步：{step}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
