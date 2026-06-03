import type { ReviewRecord } from "@/types"
import { RefreshCw } from "lucide-react"

export default function BalanceTable({
  record,
  onRerun,
}: {
  record: ReviewRecord
  onRerun: () => void
}) {
  const hasCorrection = record.correctionAmount !== null
  const canRerun = hasCorrection

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-2.5 px-3 font-semibold text-zinc-600 text-xs">
                项目
              </th>
              <th className="text-right py-2.5 px-3 font-semibold text-zinc-600 text-xs">
                金额（元）
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 px-3 text-zinc-700">调整前余额</td>
              <td className="py-2.5 px-3 text-right font-mono text-zinc-900">
                {record.balanceBefore.toLocaleString("zh-CN", {
                  minimumFractionDigits: 2,
                })}
              </td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 px-3 text-zinc-700">调整后余额</td>
              <td className="py-2.5 px-3 text-right font-mono text-zinc-900">
                {record.balanceAfter !== null
                  ? record.balanceAfter.toLocaleString("zh-CN", {
                      minimumFractionDigits: 2,
                    })
                  : "—"}
              </td>
            </tr>
            <tr
              className={`border-b border-zinc-100 ${
                record.balanceDiff !== null && record.balanceDiff !== 0
                  ? "bg-amber-50"
                  : ""
              }`}
            >
              <td className="py-2.5 px-3 text-zinc-700 font-medium">差异</td>
              <td
                className={`py-2.5 px-3 text-right font-mono font-bold ${
                  record.balanceDiff !== null && record.balanceDiff < 0
                    ? "text-red-600"
                    : record.balanceDiff !== null && record.balanceDiff > 0
                    ? "text-green-600"
                    : "text-zinc-900"
                }`}
              >
                {record.balanceDiff !== null
                  ? (record.balanceDiff >= 0 ? "+" : "") +
                    record.balanceDiff.toLocaleString("zh-CN", {
                      minimumFractionDigits: 2,
                    })
                  : "—"}
              </td>
            </tr>
            {hasCorrection && (
              <tr className="border-b border-zinc-100 bg-orange-50">
                <td className="py-2.5 px-3 text-zinc-700">
                  人工修正
                  <span className="text-[10px] text-zinc-400 ml-1">
                    {record.correctionReason}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-orange-600 font-bold">
                  +{record.correctionAmount!.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canRerun && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onRerun}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-purple-50 text-purple-700 border border-purple-200
              hover:bg-purple-100 hover:border-purple-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重跑余额变化表
          </button>
        </div>
      )}
    </div>
  )
}
