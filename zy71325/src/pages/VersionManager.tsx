import { useState } from "react"
import { useStore } from "@/store"
import { formatDateTime } from "@/utils/hash"
import { GitBranch, Plus, ChevronRight, ChevronDown, Clock, Save } from "lucide-react"
import type { AlignmentVersion } from "@/types"

export default function VersionManager() {
  const { currentSessionId, versions, saveVersion, tracks, anomalies, isProcessing } = useStore()
  const [summary, setSummary] = useState("")
  const [showSave, setShowSave] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  const handleSave = async () => {
    if (!summary.trim()) return
    await saveVersion(summary.trim())
    setSummary("")
    setShowSave(false)
  }

  if (!currentSessionId) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <GitBranch size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">请先在导入工作台创建或选择排练场次</h3>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">版本管理</h1>
          <p className="text-sm text-gray-500 mt-1">保存整理状态、对比不同版本差异</p>
        </div>
        <button
          onClick={() => setShowSave(!showSave)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-md text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          <Save size={16} />
          保存当前版本
        </button>
      </div>

      {showSave && (
        <div className="bg-[#12122A] border border-amber-500/30 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-amber-400 mb-3">保存新版本</h3>
          <div className="flex gap-2">
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="版本摘要，如：修正鼓轨偏移 + 标注漂移段"
              className="flex-1 bg-[#0F0F1A] border border-[#2A2A4A] rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!summary.trim() || isProcessing}
              className="px-4 py-2 bg-amber-500 text-black rounded-md text-sm font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              保存
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            当前状态: {tracks.length} 轨 · {anomalies.length} 异常 · {anomalies.filter((a) => a.resolved).length} 已处理
          </p>
        </div>
      )}

      {versions.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <GitBranch size={40} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">暂无保存的版本</p>
          <p className="text-xs mt-1">运行检测并确认标注后，保存版本以记录整理状态</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-[#2A2A4A]" />

          <div className="space-y-4">
            {versions.map((version: AlignmentVersion, idx: number) => {
              const isExpanded = expandedId === version.id
              const isCompare = compareIds?.includes(version.id)

              return (
                <div key={version.id} className="relative pl-10">
                  <div className="absolute left-3.5 top-4 w-3 h-3 rounded-full bg-amber-500 border-2 border-[#0F0F1A] z-10" />

                  <div className="bg-[#12122A] border border-[#2A2A4A] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : version.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-[#1A1A35] transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-gray-500 shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">
                            v{(versions.length - idx).toString().padStart(3, "0")}
                          </span>
                          <span className="text-xs text-gray-500">·</span>
                          <span className="text-xs text-gray-500 truncate">{version.summary}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatDateTime(version.createdAt)}
                          </span>
                          <span>{version.trackStates.length} 轨</span>
                          <span>{version.anomalies.length} 异常</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!compareIds) {
                            setCompareIds([version.id, ""])
                          } else if (compareIds[1] === "") {
                            setCompareIds(compareIds[0] === version.id ? null : [compareIds[0], version.id])
                          } else {
                            setCompareIds(null)
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          isCompare
                            ? "bg-amber-500/20 text-amber-400"
                            : "text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        对比
                      </button>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-[#2A2A4A]">
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <h4 className="text-xs text-gray-500 mb-2">轨道状态</h4>
                            {version.trackStates.map((ts) => {
                              const track = tracks.find((t) => t.id === ts.trackId)
                              return (
                                <div key={ts.trackId} className="text-xs text-gray-400 mb-1">
                                  <span className="text-gray-300">{track?.fileName || ts.trackId}</span>
                                  <span className="text-gray-600 ml-2">偏移 {ts.offsetMs}ms</span>
                                  {ts.driftSegments.length > 0 && (
                                    <span className="text-red-400/60 ml-2">漂移 ×{ts.driftSegments.length}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <div>
                            <h4 className="text-xs text-gray-500 mb-2">异常记录</h4>
                            <div className="text-xs text-gray-600">
                              共 {version.anomalies.length} 条，
                              {version.anomalies.filter((a) => a.resolved).length} 已处理
                            </div>
                            {version.parentVersionId && (
                              <div className="text-xs text-gray-600 mt-2">
                                继承自: v...
                                {version.parentVersionId.slice(0, 6)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {compareIds && compareIds[1] !== "" && (
        <VersionCompare
          v1={versions.find((v) => v.id === compareIds[0])}
          v2={versions.find((v) => v.id === compareIds[1])}
          onClose={() => setCompareIds(null)}
        />
      )}
    </div>
  )
}

function VersionCompare({
  v1,
  v2,
  onClose,
}: {
  v1?: AlignmentVersion
  v2?: AlignmentVersion
  onClose: () => void
}) {
  if (!v1 || !v2) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A35] border border-[#2A2A4A] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-100">版本对比</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">关闭</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[v1, v2].map((v, i) => (
            <div key={v.id} className="bg-[#0F0F1A] rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                {i === 0 ? "版本 A" : "版本 B"}
              </h4>
              <p className="text-xs text-gray-500 mb-1">{v.summary}</p>
              <p className="text-[10px] text-gray-600 mb-3">{formatDateTime(v.createdAt)}</p>

              <div className="space-y-1">
                <div className="text-xs text-gray-400">
                  轨道数: <span className="text-gray-200">{v.trackStates.length}</span>
                </div>
                <div className="text-xs text-gray-400">
                  异常数: <span className="text-gray-200">{v.anomalies.length}</span>
                </div>
                <div className="text-xs text-gray-400">
                  已处理: <span className="text-emerald-400">{v.anomalies.filter((a) => a.resolved).length}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#2A2A4A]">
                <h5 className="text-[10px] text-gray-600 mb-1">偏移差异</h5>
                {v.trackStates.map((ts) => {
                  const other = (i === 0 ? v2 : v1).trackStates.find((t) => t.trackId === ts.trackId)
                  const diff = other ? ts.offsetMs - other.offsetMs : ts.offsetMs
                  return (
                    <div key={ts.trackId} className="text-xs font-mono">
                      <span className="text-gray-500">{ts.trackId.slice(0, 6)}</span>
                      <span className={`ml-2 ${diff !== 0 ? "text-amber-400" : "text-gray-600"}`}>
                        {ts.offsetMs}ms {diff !== 0 ? `(${diff > 0 ? "+" : ""}${diff})` : ""}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
