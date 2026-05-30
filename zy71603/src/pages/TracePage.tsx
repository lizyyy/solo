import { useEffect } from "react"
import { useAnalysisStore } from "@/store/useAnalysisStore"
import TraceTimeline from "@/components/TraceTimeline"

export default function TracePage() {
  const { result, runAnalysis } = useAnalysisStore()

  useEffect(() => {
    if (!result) runAnalysis()
  }, [result, runAnalysis])

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-[#a0a0b0] text-lg">正在加载分析记录...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#f0ece4]">异常留痕</h1>
        <p className="text-sm text-[#a0a0b0] mt-1">按分析步骤查看中间结果与异常记录</p>
      </div>
      <TraceTimeline />
    </div>
  )
}
