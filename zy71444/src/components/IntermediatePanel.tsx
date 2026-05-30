import { useState } from "react"
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from "lucide-react"
import type { IntermediateStep } from "@/data/types"

interface IntermediatePanelProps {
  steps: IntermediateStep[]
}

function formatNum(v: number) {
  return v.toLocaleString("zh-CN", { maximumFractionDigits: 4 })
}

export default function IntermediatePanel({ steps }: IntermediatePanelProps) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <StepCard key={i} step={step} />
      ))}
    </div>
  )
}

function StepCard({ step }: { step: IntermediateStep }) {
  const [open, setOpen] = useState(false)

  const hasThreshold = step.threshold !== undefined
  const passThreshold = hasThreshold ? Math.abs(step.outputValue) <= step.threshold! : true

  return (
    <div className="rounded border border-gray-700 bg-[#161b22]">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-300 hover:bg-gray-800/50"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        )}
        <span className="text-xs font-medium">{step.step}</span>
        {hasThreshold && (
          passThreshold ? (
            <CheckCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-green-400" />
          ) : (
            <XCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-red-400" />
          )
        )}
      </button>

      {open && (
        <div className="border-t border-gray-700 px-3 py-2 text-xs text-gray-400 space-y-2">
          {step.description && <p>{step.description}</p>}

          <div>
            <span className="text-gray-500">输入值:</span>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {Object.entries(step.inputValues).map(([k, v]) => (
                <span key={k}>
                  {k}=<span className="text-gray-300">{formatNum(v)}</span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-gray-500">输出值: </span>
            <span className="text-cyan-400 font-medium">{formatNum(step.outputValue)}</span>
          </div>

          {hasThreshold && (
            <div>
              <span className="text-gray-500">阈值: </span>
              <span className="text-gray-300">{formatNum(step.threshold!)}</span>
              <span className={`ml-2 ${passThreshold ? "text-green-400" : "text-red-400"}`}>
                {passThreshold ? "通过" : "超限"}
              </span>
            </div>
          )}

          {step.reasoning && (
            <p className="italic text-gray-500">{step.reasoning}</p>
          )}
        </div>
      )}
    </div>
  )
}
