import { useState } from "react"
import { useStore } from "@/store/useStore"
import { GRADE_COLORS, GRADE_LABELS } from "@/types"
import type { GradingResult } from "@/types"
import { ChevronDown, ChevronRight, Info, Tag, Clock } from "lucide-react"

function GradingCard({ result }: { result: GradingResult }) {
  const [open, setOpen] = useState(false)
  const hasTradeoff = result.tradeoffReason.trim().length > 0

  return (
    <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className={`w-1.5 shrink-0 ${GRADE_COLORS[result.slopeGrade]}`} />
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-900">{result.slopeName}</h3>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-700">
              {GRADE_LABELS[result.slopeGrade]}
            </span>
            <span className="text-lg font-bold text-gray-900">
              {result.slopeAngle}°
            </span>
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            参数版本与取舍理由
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>

        {open && (
          <div className="mt-3 space-y-3 border-t pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <Tag className="h-3 w-3" />
                {result.paramVersion}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                <Tag className="h-3 w-3" />
                {result.modelVersion}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {result.calculatedAt}
              </span>
            </div>

            {hasTradeoff ? (
              <div className="flex items-start gap-2 rounded-lg bg-frost-100 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <p className="text-sm text-gray-700">{result.tradeoffReason}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">无冲突取舍</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GradingPage() {
  const { gradingResults } = useStore()

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-xl font-bold text-gray-900">坡度分级结果</h1>

      {gradingResults.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">暂无分级数据</p>
      ) : (
        <div className="space-y-3">
          {gradingResults.map((r) => (
            <GradingCard key={r.id} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}
