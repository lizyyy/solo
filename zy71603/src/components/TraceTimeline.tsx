import { useState } from "react"
import { AlertTriangle, AlertCircle, Info, Download, ChevronDown, ChevronRight } from "lucide-react"
import type { AnomalyRecord } from "@/engine/types"
import { useAnalysisStore } from "@/store/useAnalysisStore"
import { exportAnomaliesToCSV } from "@/utils/csvExport"
import { cn } from "@/lib/utils"

const STEPS = [
  { step: "creditor_check" as const, label: "债权校验" },
  { step: "confirm_status" as const, label: "确认状态" },
  { step: "repayment_match" as const, label: "回款匹配" },
  { step: "summary" as const, label: "异常汇总" },
]

const severityIcon = {
  error: AlertTriangle,
  warning: AlertCircle,
  info: Info,
}

const severityBorder = {
  error: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-neutral-500",
}

const severityIconColor = {
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-neutral-400",
}

function getDotColor(anomalies: AnomalyRecord[]): string {
  if (anomalies.some((a) => a.severity === "error")) return "bg-red-500"
  if (anomalies.some((a) => a.severity === "warning")) return "bg-amber-500"
  return "bg-green-500"
}

function AnomalyItem({ anomaly }: { anomaly: AnomalyRecord }) {
  const [open, setOpen] = useState(false)
  const Icon = severityIcon[anomaly.severity]

  return (
    <div
      className={cn(
        "border-l-4 rounded-r-md bg-[#242938] p-3 cursor-pointer hover:bg-[#2a3042] transition-colors",
        severityBorder[anomaly.severity]
      )}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-start gap-2">
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#a0a0b0]" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#a0a0b0]" />
        )}
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", severityIconColor[anomaly.severity])} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#f0ece4]">{anomaly.category}</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                anomaly.severity === "error" && "bg-red-500/20 text-red-400",
                anomaly.severity === "warning" && "bg-amber-500/20 text-amber-400",
                anomaly.severity === "info" && "bg-neutral-500/20 text-neutral-400"
              )}
            >
              {anomaly.severity === "error" ? "严重" : anomaly.severity === "warning" ? "警告" : "提示"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#a0a0b0]">{anomaly.description}</p>
          {open && (
            <div className="mt-2 rounded-md bg-[#1e2230] px-3 py-2">
              <p className="text-xs font-medium text-[#f0ece4]/50">影响说明</p>
              <p className="mt-1 text-sm text-[#f0ece4]/80">{anomaly.impact}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TraceTimeline() {
  const result = useAnalysisStore((s) => s.result)
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({})

  if (!result) return null

  const anomalies = result.anomalies

  const toggleStep = (step: string) => {
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }))
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-[#a0a0b0]">
          共 {anomalies.length} 条异常记录，点击步骤展开查看详情
        </span>
        <button
          type="button"
          onClick={() => exportAnomaliesToCSV(anomalies)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a3042] bg-[#242938] px-4 py-2 text-sm text-[#f0ece4] hover:bg-[#2d3348] transition-colors"
        >
          <Download className="h-4 w-4" />
          导出异常清单
        </button>
      </div>

      <div className="relative">
        {STEPS.map((stepDef, idx) => {
          const stepAnomalies = anomalies.filter((a) => a.step === stepDef.step)
          const isLast = idx === STEPS.length - 1
          const isExpanded = expandedSteps[stepDef.step] ?? false
          const dotColor = getDotColor(stepAnomalies)

          return (
            <div key={stepDef.step} className="flex gap-5">
              <div className="relative flex flex-col items-center">
                <div className={cn("h-3.5 w-3.5 rounded-full ring-4 ring-[#1a1f2e]", dotColor)} />
                {!isLast && <div className="w-0.5 flex-1 bg-[#2a3042]" />}
              </div>

              <div className={cn("pb-8", isLast && "pb-0")}>
                <div
                  className="flex cursor-pointer items-center gap-3 group"
                  onClick={() => toggleStep(stepDef.step)}
                >
                  <span className="text-sm font-semibold text-[#f0ece4] group-hover:text-[#22c55e] transition-colors">
                    {stepDef.label}
                  </span>
                  {stepAnomalies.length > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-xs font-medium text-red-400">
                      {stepAnomalies.length}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500/20 px-1.5 text-xs font-medium text-green-400">
                      0
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[#a0a0b0]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#a0a0b0]" />
                  )}
                </div>

                {isExpanded && stepAnomalies.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {stepAnomalies.map((a) => (
                      <AnomalyItem key={a.id} anomaly={a} />
                    ))}
                  </div>
                )}

                {isExpanded && stepAnomalies.length === 0 && (
                  <p className="mt-2 text-sm text-[#a0a0b0]/50">该步骤无异常记录</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
