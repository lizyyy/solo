import { useState } from "react"
import { useStore } from "@/store/useStore"
import type { RecordStatus } from "@/types"
import { SOURCE_LABELS, STATUS_LABELS } from "@/types"
import StatusBadge from "@/components/StatusBadge"
import HistoryTimeline from "@/components/HistoryTimeline"
import { ChevronDown, ChevronRight } from "lucide-react"

type FilterKey = "all" | RecordStatus

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "normal", label: "正常" },
  { key: "pending_review", label: "待复核" },
  { key: "supplemented", label: "已补录" },
  { key: "conflict", label: "冲突" },
  { key: "rejected", label: "已驳回" },
]

export default function ObstructionsPage() {
  const { obstructionPoints, getHistoryForPoint } = useStore()
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const countByStatus = (status: RecordStatus) =>
    obstructionPoints.filter((p) => p.status === status).length

  const filtered =
    activeFilter === "all"
      ? obstructionPoints
      : obstructionPoints.filter((p) => p.status === activeFilter)

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-xl font-bold text-gray-900">遮挡点清单</h1>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            {tab.key !== "all" && (
              <span
                className={`rounded-full px-1.5 text-xs ${
                  activeFilter === tab.key
                    ? "bg-blue-500 text-blue-100"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {countByStatus(tab.key as RecordStatus)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3" />
              <th className="px-4 py-3">编号</th>
              <th className="px-4 py-3">标签</th>
              <th className="px-4 py-3">经度</th>
              <th className="px-4 py-3">纬度</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">来源</th>
              <th className="px-4 py-3">确认人</th>
              <th className="px-4 py-3">确认时间</th>
              <th className="px-4 py-3">理由</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((point) => {
              const isExpanded = expandedId === point.id
              return (
                <tr key={point.id} className="border-b last:border-b-0">
                  <td colSpan={10} className="p-0">
                    <div
                      className="flex cursor-pointer items-center hover:bg-gray-50"
                      onClick={() => toggle(point.id)}
                    >
                      <span className="w-10 pl-4">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </span>
                      <span className="flex-1 py-3 pr-4">
                        <span className="flex w-full items-center">
                          <span className="w-24 px-2 text-gray-600">{point.id}</span>
                          <span className="w-32 px-2 font-medium">{point.label}</span>
                          <span className="w-28 px-2 font-mono text-xs">{point.longitude}</span>
                          <span className="w-28 px-2 font-mono text-xs">{point.latitude}</span>
                          <span className="w-20 px-2"><StatusBadge status={point.status} /></span>
                          <span className="w-24 px-2 text-gray-600">{SOURCE_LABELS[point.sourceType]}</span>
                          <span className="w-20 px-2 text-gray-600">{point.confirmedBy || "—"}</span>
                          <span className="w-36 px-2 text-xs text-gray-500">{point.confirmedAt || "—"}</span>
                          <span className="flex-1 px-2 truncate text-gray-500">{point.reason || "—"}</span>
                        </span>
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-gray-50/50 px-14 py-4">
                        <HistoryTimeline items={getHistoryForPoint(point.id)} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">暂无数据</p>
        )}
      </div>
    </div>
  )
}
