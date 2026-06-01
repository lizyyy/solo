import { useState } from "react"
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react"
import type { ComputationTrace as ComputationTraceType } from "@/types"

interface ComputationTraceProps {
  trace: ComputationTraceType
}

export default function ComputationTrace({ trace }: ComputationTraceProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const expandAll = () => {
    setExpandedSteps(new Set(trace.steps.map((_, i) => i)))
  }

  const collapseAll = () => {
    setExpandedSteps(new Set())
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-coffee-800">计算过程</h3>
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-xs text-coffee-500 hover:text-coffee-700">全部展开</button>
          <button onClick={collapseAll} className="text-xs text-coffee-500 hover:text-coffee-700">全部折叠</button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {trace.steps.map((step, index) => {
          const isExpanded = expandedSteps.has(index)
          return (
            <div key={index} className="border border-coffee-200 rounded-md overflow-hidden">
              <button
                onClick={() => toggleStep(index)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-coffee-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-coffee-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-coffee-400 shrink-0" />
                )}
                <span className="text-xs font-medium text-coffee-700 flex-1">{step.name}</span>
                <span className="badge bg-coffee-50 border-coffee-200 text-coffee-600">
                  参数 v{step.parameterVersionUsed}
                </span>
                <span className="badge bg-amber-50 border-amber-200 text-amber-700">
                  阈值 v{step.thresholdVersionUsed}
                </span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2.5 pt-1 text-xs space-y-2 bg-coffee-50/50 border-t border-coffee-100">
                  <div>
                    <span className="text-coffee-400 font-medium">公式：</span>
                    <code className="text-coffee-800 bg-coffee-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      {step.formula}
                    </code>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-coffee-400 font-medium">输入：</span>
                      <span className="text-coffee-700">
                        {Object.entries(step.input).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(", ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-coffee-400 font-medium">输出：</span>
                      <span className="text-coffee-800 font-mono font-medium">{step.output.toFixed(2)}°C</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-coffee-200 pt-3 space-y-2">
        <h4 className="text-xs font-semibold text-coffee-700">最终结果</h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-coffee-50 rounded-md p-2">
            <div className="text-[10px] text-coffee-400">中心温度</div>
            <div className="text-sm font-mono font-semibold text-coffee-800">
              {trace.result.finalCenterTemp}°C
            </div>
          </div>
          <div className="bg-coffee-50 rounded-md p-2">
            <div className="text-[10px] text-coffee-400">表面温度</div>
            <div className="text-sm font-mono font-semibold text-coffee-800">
              {trace.result.finalSurfaceTemp}°C
            </div>
          </div>
          <div className="bg-coffee-50 rounded-md p-2">
            <div className="text-[10px] text-coffee-400">温度梯度</div>
            <div className="text-sm font-mono font-semibold text-coffee-800">
              {trace.result.gradient}°C
            </div>
          </div>
        </div>
        {trace.result.isExceedingThreshold && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-red-700">超出阈值！</span>
              <span className="text-red-600 ml-1">
                中心温度 {trace.result.finalCenterTemp}°C &gt; 阈值 {trace.result.thresholdValueUsed}°C
                (v{trace.result.thresholdVersionUsed})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
