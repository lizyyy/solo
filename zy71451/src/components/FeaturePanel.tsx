import { useState, useMemo } from "react"
import { SlidersHorizontal, Search, Check } from "lucide-react"
import { useClusterStore } from "@/store/clusterStore"
import { cn } from "@/lib/utils"
import type { AxisMapping } from "@/types"

const AXIS_COLORS: Record<string, string> = {
  x: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30 shadow-[0_0_8px_rgba(0,255,255,0.3)]",
  y: "text-green-400 bg-green-400/10 border-green-400/30 shadow-[0_0_8px_rgba(74,222,128,0.3)]",
  z: "text-purple-400 bg-purple-400/10 border-purple-400/30 shadow-[0_0_8px_rgba(168,85,247,0.3)]",
}

const AXIS_CYCLE: AxisMapping[] = ["x", "y", "z", null]

function cycleAxis(current: AxisMapping): AxisMapping {
  const idx = AXIS_CYCLE.indexOf(current)
  return AXIS_CYCLE[(idx + 1) % AXIS_CYCLE.length]
}

export default function FeaturePanel() {
  const [search, setSearch] = useState("")
  const featureColumns = useClusterStore((s) => s.featureColumns)
  const projectionMode = useClusterStore((s) => s.projectionMode)
  const varianceRatios = useClusterStore((s) => s.varianceRatios)
  const toggleFeature = useClusterStore((s) => s.toggleFeature)
  const setAxisMapping = useClusterStore((s) => s.setAxisMapping)

  const filtered = useMemo(
    () =>
      featureColumns
        .slice()
        .sort((a, b) => a.order - b.order)
        .filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [featureColumns, search]
  )

  const totalVariance = varianceRatios.reduce((sum, r) => sum + r, 0)
  const selectedCount = featureColumns.filter((f) => f.selected).length

  const handleAxisClick = (featureId: string, current: AxisMapping) => {
    setAxisMapping(featureId, cycleAxis(current))
  }

  return (
    <div className="w-[280px] h-full bg-[#1a2332]/95 rounded-xl border border-[#2a3444] flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal size={16} className="text-[#00f5d4]" />
          <h2 className="font-['Space_Grotesk'] text-sm font-semibold text-[#e8edf5]">特征筛选</h2>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a6a7a]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索特征..."
            className="w-full h-8 pl-8 pr-3 bg-[#0f1822] border border-[#2a3444] rounded-lg text-xs text-[#e8edf5] placeholder-[#5a6a7a] font-['DM_Sans'] focus:outline-none focus:border-[#00f5d4]/50 transition-colors"
          />
        </div>
      </div>

      <div className="px-4 pb-2 flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] font-['DM_Sans'] font-medium px-2 py-0.5 rounded-full",
            projectionMode === "pca"
              ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
              : "bg-purple-400/10 text-purple-400 border border-purple-400/20"
          )}
        >
          {projectionMode === "pca" ? "PCA降维" : "轴映射"}
        </span>
        <span className="text-[10px] text-[#5a6a7a] font-['DM_Sans']">
          {selectedCount}/{featureColumns.length} 选中
        </span>
      </div>

      {projectionMode === "pca" && varianceRatios.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 border-b border-[#2a3444]">
          {varianceRatios.slice(0, 3).map((ratio, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-[#5a6a7a] font-['DM_Sans'] w-5">PC{i + 1}</span>
              <div className="flex-1 h-1.5 bg-[#0f1822] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00f5d4] to-[#00b894] transition-all"
                  style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#8a9aaa] font-['DM_Sans'] w-10 text-right">
                {(ratio * 100).toFixed(1)}%
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-[#5a6a7a] font-['DM_Sans']">总解释方差</span>
            <span className="text-[10px] font-semibold text-[#00f5d4] font-['DM_Sans']">
              {(totalVariance * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filtered.map((feature) => (
          <div
            key={feature.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-[#0f1822]/60 transition-colors",
              !feature.selected && "opacity-50"
            )}
          >
            <button
              onClick={() => toggleFeature(feature.id)}
              className={cn(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                feature.selected
                  ? "bg-[#00f5d4] border-[#00f5d4] shadow-[0_0_6px_rgba(0,245,212,0.4)]"
                  : "border-[#2a3444] hover:border-[#00f5d4]/50 hover:shadow-[0_0_6px_rgba(0,245,212,0.2)]"
              )}
            >
              {feature.selected && <Check size={10} className="text-[#0f1822]" />}
            </button>
            <span
              className={cn(
                "flex-1 text-xs font-['DM_Sans'] truncate",
                feature.selected ? "text-[#e8edf5]" : "text-[#5a6a7a]"
              )}
            >
              {feature.name}
            </span>
            <button
              onClick={() => handleAxisClick(feature.id, feature.axisMapping)}
              className={cn(
                "text-[10px] font-['DM_Sans'] font-semibold px-1.5 py-0.5 rounded border transition-all hover:scale-110",
                feature.axisMapping
                  ? AXIS_COLORS[feature.axisMapping]
                  : "text-[#3a4a5a] bg-transparent border-[#2a3444] hover:text-[#5a6a7a] hover:border-[#3a4a5a]"
              )}
            >
              {feature.axisMapping ? feature.axisMapping.toUpperCase() : "—"}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-[10px] text-[#5a6a7a] font-['DM_Sans'] py-6">
            未找到匹配的特征
          </div>
        )}
      </div>
    </div>
  )
}
