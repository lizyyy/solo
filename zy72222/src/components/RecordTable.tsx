import { useReviewStore } from "@/store/useReviewStore"
import StatusBadge from "./StatusBadge"
import { Eye, Trash2, RotateCcw } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { RecordStatus } from "@/types"
import { useState } from "react"

export default function RecordTable() {
  const records = useReviewStore((s) => s.records)
  const resetToDemo = useReviewStore((s) => s.resetToDemo)
  const navigate = useNavigate()
  const [filter, setFilter] = useState<RecordStatus | "all">("all")

  const filtered =
    filter === "all" ? records : records.filter((r) => r.status === filter)

  const counts = {
    all: records.length,
    normal: records.filter((r) => r.status === "normal").length,
    pending_review: records.filter((r) => r.status === "pending_review").length,
    pending_supplement: records.filter((r) => r.status === "pending_supplement")
      .length,
  }

  const filterOptions: { key: RecordStatus | "all"; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "normal", label: "正常" },
    { key: "pending_review", label: "待复核" },
    { key: "pending_supplement", label: "待补录" },
  ]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-zinc-800">复盘记录</h3>
          <span className="text-[10px] text-zinc-400">
            共 {records.length} 条
          </span>
        </div>
        <button
          onClick={resetToDemo}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          重置演示数据
        </button>
      </div>

      <div className="px-5 py-2 border-b border-zinc-100 flex gap-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === opt.key
                ? "bg-teal-50 text-teal-700 border border-teal-200"
                : "text-zinc-500 hover:bg-zinc-50 border border-transparent"
            }`}
          >
            {opt.label}
            <span className="ml-1 text-[10px] opacity-60">{counts[opt.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-zinc-400">暂无记录</p>
          <p className="text-xs text-zinc-300 mt-1">
            点击上方"导入税费率备注"或"重置演示数据"
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  日期
                </th>
                <th className="text-left py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  柜台
                </th>
                <th className="text-left py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  税费率备注
                </th>
                <th className="text-left py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  审批人
                </th>
                <th className="text-left py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  余额差异
                </th>
                <th className="text-left py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  状态
                </th>
                <th className="text-right py-2.5 px-4 font-semibold text-zinc-500 text-xs">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr
                  key={rec.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/review/${rec.id}`)}
                >
                  <td className="py-3 px-4 text-zinc-800 font-mono text-xs">
                    {rec.date}
                  </td>
                  <td className="py-3 px-4 text-zinc-700">{rec.counterNo}</td>
                  <td className="py-3 px-4 text-zinc-600 max-w-[200px] truncate">
                    {rec.taxRateRemark}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        rec.approverType === "pinyin"
                          ? "text-amber-600 font-medium"
                          : "text-zinc-700"
                      }
                    >
                      {rec.approver}
                    </span>
                    {rec.approverType === "pinyin" && (
                      <span className="ml-1 text-[10px] text-amber-500">
                        （拼音）
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">
                    {rec.balanceDiff !== null ? (
                      <span
                        className={
                          rec.balanceDiff < 0
                            ? "text-red-600"
                            : rec.balanceDiff > 0
                            ? "text-green-600"
                            : "text-zinc-800"
                        }
                      >
                        {(rec.balanceDiff >= 0 ? "+" : "") +
                          rec.balanceDiff.toLocaleString("zh-CN", {
                            minimumFractionDigits: 2,
                          })}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={rec.status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/review/${rec.id}`)
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-teal-600 hover:bg-teal-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
