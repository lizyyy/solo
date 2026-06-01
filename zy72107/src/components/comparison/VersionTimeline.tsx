import type { ThresholdVersion } from "@/types"
import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"

interface VersionTimelineProps {
  versions: ThresholdVersion[]
  currentVersion: number
}

export default function VersionTimeline({ versions, currentVersion }: VersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-stone-400">
        <Clock className="h-8 w-8 mb-2" />
        <span>暂无版本记录</span>
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-stone-200" />

      <div className="flex flex-col gap-4">
        {versions.map((v) => {
          const isCurrent = v.version === currentVersion
          return (
            <div key={v.version} className="relative flex gap-3">
              <div
                className={cn(
                  "absolute -left-6 top-1 rounded-full border-2",
                  isCurrent
                    ? "h-4 w-4 border-blue-500 bg-blue-500 -translate-x-[5px]"
                    : "h-3 w-3 border-stone-300 bg-white -translate-x-[3px]",
                )}
              />

              <div
                className={cn(
                  "flex-1 rounded-lg p-3",
                  isCurrent
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-white border border-stone-100",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "text-xs font-semibold px-1.5 py-0.5 rounded",
                      isCurrent
                        ? "bg-blue-500 text-white"
                        : "bg-stone-200 text-stone-600",
                    )}
                  >
                    v{v.version}
                  </span>
                  <span className="text-sm font-medium text-stone-700">
                    {v.maxValue} {v.unit}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-blue-600 font-medium">当前</span>
                  )}
                </div>

                <div className="text-xs text-stone-500 space-y-0.5">
                  <div>变更人: {v.changedBy}</div>
                  <div>时间: {v.changedAt}</div>
                  {v.reason && <div>原因: {v.reason}</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
