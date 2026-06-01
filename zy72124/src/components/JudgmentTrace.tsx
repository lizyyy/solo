import type { MooringRecord } from "@/types"
import { StatusBadge } from "./StatusBadge"
import { Clock, GitBranch, FileSearch, Database, Activity } from "lucide-react"

interface JudgmentTraceProps {
  record: MooringRecord
}

export function JudgmentTrace({ record }: JudgmentTraceProps) {
  const steps = [
    {
      icon: Database,
      label: "数据来源",
      value: record.source === "manual" ? "手动录入" : record.source === "sensor_log" ? "传感器日志" : "旧口径补录",
      detail: record.sourceNote,
    },
    {
      icon: Activity,
      label: "采样处理",
      value: `${record.rawData.length} 个采样点`,
      detail: record.rawData.filter((r) => r.isGap).length > 0
        ? `缺口 ${record.rawData.filter((r) => r.isGap).length} 处，已线性插值`
        : "无缺口，数据完整",
    },
    {
      icon: FileSearch,
      label: "阈值判断",
      value: (
        <span className="flex items-center gap-2">
          <StatusBadge status={record.judgment.status} size="md" />
          <span className="text-slate-400 text-xs">
            占阈值 {(record.judgment.ratioToThreshold * 100).toFixed(1)}%
          </span>
        </span>
      ),
      detail: record.judgment.reason,
    },
    {
      icon: GitBranch,
      label: "阈值版本",
      value: record.judgment.thresholdVersion,
      detail: `阈值 ${record.judgment.thresholdValueKN} kN`,
    },
    {
      icon: Clock,
      label: "判断时间",
      value: new Date(record.judgment.judgedAt).toLocaleString("zh-CN"),
      detail: "系统自动判断",
    },
  ]

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">判断溯源链</h3>
      <div className="relative pl-6">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-700/50" />
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={i} className="relative pb-5 last:pb-0">
              <div className="absolute left-[-18px] top-0.5 w-[22px] h-[22px] rounded-full bg-slate-800 border border-slate-600/50 flex items-center justify-center">
                <Icon className="w-3 h-3 text-[#FF6B35]" />
              </div>
              <div className="ml-2">
                <div className="text-xs text-slate-500 mb-0.5">{step.label}</div>
                <div className="text-sm text-slate-200">
                  {typeof step.value === "string" ? step.value : step.value}
                </div>
                {step.detail && (
                  <div className="text-xs text-slate-400 mt-0.5">{step.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
