import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { useClusterStore } from "@/store/clusterStore"
import { getClusterColor } from "@/types"

export default function OutlierPanel() {
  const samples = useClusterStore((s) => s.samples)
  const labelAssignments = useClusterStore((s) => s.labelAssignments)
  const labelColumns = useClusterStore((s) => s.labelColumns)
  const outlierThreshold = useClusterStore((s) => s.outlierThreshold)
  const selectedSampleId = useClusterStore((s) => s.selectedSampleId)
  const setOutlierThreshold = useClusterStore((s) => s.setOutlierThreshold)
  const setSelectedSample = useClusterStore((s) => s.setSelectedSample)

  const primaryLabelId = labelColumns.find((l) => l.isPrimary)?.id ?? labelColumns[0]?.id

  const outliers = useMemo(() => {
    return samples
      .filter((s) => s.isOutlier)
      .sort((a, b) => b.outlierScore - a.outlierScore)
  }, [samples])

  const getClusterId = (sampleId: string): number => {
    if (!primaryLabelId) return -1
    const assignment = labelAssignments.find(
      (la) => la.sampleId === sampleId && la.columnId === primaryLabelId
    )
    return assignment?.clusterId ?? -1
  }

  return (
    <div className="flex h-full flex-col bg-[#1a2332] text-[#e8edf5]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-[#f5a623]" />
          <h2 className="text-sm font-semibold tracking-wide">离群点检测</h2>
        </div>
        {outliers.length > 0 && (
          <span className="rounded-full bg-[#f5a623]/20 px-2 py-0.5 text-xs font-bold text-[#f5a623]">
            {outliers.length}
          </span>
        )}
      </div>

      <div className="border-b border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[#e8edf5]/60">
          <span>阈值</span>
          <span className="font-mono text-[#00f5d4]">{outlierThreshold.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={1.0}
          max={4.0}
          step={0.1}
          value={outlierThreshold}
          onChange={(e) => setOutlierThreshold(parseFloat(e.target.value))}
          className="w-full cursor-pointer accent-[#00f5d4]"
        />
        <div className="mt-1 flex justify-between text-[10px] text-[#e8edf5]/40">
          <span>1.0</span>
          <span>4.0</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {outliers.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-[#e8edf5]/40">未检测到离群点</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {outliers.map((sample) => {
              const clusterId = getClusterId(sample.id)
              const clusterColor = getClusterColor(clusterId)
              const isSelected = selectedSampleId === sample.id

              return (
                <button
                  key={sample.id}
                  onClick={() => setSelectedSample(sample.id)}
                  className={`group flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-left transition-all ${
                    isSelected
                      ? "border-l-[#f5a623] bg-[#f5a623]/10"
                      : "border-l-[#f5a623]/40 bg-transparent hover:border-l-[#f5a623] hover:bg-[#f5a623]/5 hover:shadow-[0_0_8px_rgba(245,166,35,0.15)]"
                  }`}
                >
                  <span className="flex-shrink-0 truncate text-xs font-mono text-[#e8edf5]/80">
                    {sample.id}
                  </span>
                  {clusterId >= 0 && (
                    <span
                      className="flex-shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${clusterColor}20`,
                        color: clusterColor,
                      }}
                    >
                      C{clusterId}
                    </span>
                  )}
                  <span className="ml-auto flex-shrink-0 font-mono text-xs text-[#f5a623]">
                    {sample.outlierScore.toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
