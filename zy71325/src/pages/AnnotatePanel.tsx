import { useState } from "react"
import { useStore } from "@/store"
import { ANOMALY_TYPE_LABELS, type AnomalyType } from "@/types"
import AnomalyCard from "@/components/AnomalyCard"
import TimelineBar from "@/components/TimelineBar"
import { Tag, Filter } from "lucide-react"

const ANOMALY_TYPES: AnomalyType[] = ["offset_error", "beat_drift", "duplicate_clip", "late_join"]

export default function AnnotatePanel() {
  const { currentSessionId, tracks, anomalies, updateAnomaly, maxDuration } = useStore() as {
    currentSessionId: string | null
    tracks: { id: string; fileName: string; duration: number }[]
    anomalies: import("@/types").AnomalyFragment[]
    updateAnomaly: (id: string, updates: Partial<import("@/types").AnomalyFragment>) => void
    maxDuration?: number
  }

  const store = useStore()
  const duration = tracks.length > 0 ? Math.max(...tracks.map((t) => t.duration)) : 0

  const [typeFilter, setTypeFilter] = useState<AnomalyType | "all">("all")
  const [showResolved, setShowResolved] = useState(false)

  const filtered = anomalies.filter((a) => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false
    if (!showResolved && a.resolved) return false
    return true
  })

  const resolvedCount = anomalies.filter((a) => a.resolved).length

  if (!currentSessionId) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <Tag size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">请先在导入工作台创建或选择排练场次</h3>
      </div>
    )
  }

  if (anomalies.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <Tag size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">暂无异常片段</h3>
        <p className="text-sm text-gray-600 mt-2">请先在对齐检测面板运行检测</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100">片段标注台</h1>
        <p className="text-sm text-gray-500 mt-1">查看、编辑和确认异常片段标注</p>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-300 mb-3">全局时间轴标注</h3>
        <TimelineBar duration={duration} anomalies={anomalies} />
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500">类型筛选:</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter("all")}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              typeFilter === "all"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-[#1A1A35] text-gray-500 border border-transparent hover:text-gray-300"
            }`}
          >
            全部 ({anomalies.length})
          </button>
          {ANOMALY_TYPES.map((type) => {
            const count = anomalies.filter((a) => a.type === type).length
            if (count === 0) return null
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  typeFilter === type
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-[#1A1A35] text-gray-500 border border-transparent hover:text-gray-300"
                }`}
              >
                {ANOMALY_TYPE_LABELS[type]} ({count})
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-amber-500"
          />
          <span className="text-xs text-gray-500">显示已处理 ({resolvedCount})</span>
        </label>
      </div>

      <div className="space-y-2">
        {filtered.map((anomaly) => {
          const track = tracks.find((t) => t.id === anomaly.trackId)
          return (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onUpdate={updateAnomaly}
              trackName={track?.fileName}
            />
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-sm">
            没有匹配的异常片段
          </div>
        )}
      </div>
    </div>
  )
}
