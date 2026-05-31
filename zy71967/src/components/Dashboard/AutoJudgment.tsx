import { useState, useMemo } from "react"
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"

export default function AutoJudgment() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const judgments = useAppStore((s) => s.judgments)
  const getExperimentMetrics = useAppStore((s) => s.getExperimentMetrics)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const metrics = selectedExperimentId ? getExperimentMetrics(selectedExperimentId) : []

  const metricMap = useMemo(() => {
    const map = new Map<string, { name: string; value: string }>()
    for (const m of metrics) map.set(m.id, { name: m.name, value: m.value })
    return map
  }, [metrics])

  const relevantJudgments = useMemo(
    () => judgments.filter((j) => metricMap.has(j.metricId)),
    [judgments, metricMap]
  )

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-md bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">自动判断</h3>

      {relevantJudgments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {selectedExperimentId ? "暂无判断结果" : "请先选择实验"}
        </p>
      ) : (
        <div className="space-y-1">
          {relevantJudgments.map((j) => {
            const metric = metricMap.get(j.metricId)
            const expanded = expandedIds.has(j.id)
            const passed = j.result === "pass"

            return (
              <div
                key={j.id}
                className="rounded border border-slate-700 bg-slate-900/60"
              >
                <button
                  onClick={() => toggle(j.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  {passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}

                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium",
                      passed
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    )}
                  >
                    {passed ? "达标" : "未达标"}
                  </span>

                  <span className="text-sm text-slate-300">
                    {metric?.name}
                    <span className="ml-2 font-mono text-xs text-slate-500">{metric?.value}</span>
                  </span>

                  <span className="ml-auto shrink-0 text-slate-500">
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-slate-700/60 px-3 py-2.5">
                    <p className="text-xs leading-relaxed text-slate-400">{j.reason}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
