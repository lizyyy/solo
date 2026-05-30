import { useEffect, useState } from "react"
import { Layers, Maximize2, Minimize2, Info } from "lucide-react"
import Scene3D from "@/components/Scene3D"
import FeaturePanel from "@/components/FeaturePanel"
import OutlierPanel from "@/components/OutlierPanel"
import DataUploader from "@/components/DataUploader"
import BatchRecords from "@/components/BatchRecords"
import HistoryTimeline from "@/components/HistoryTimeline"
import { useClusterStore } from "@/store/clusterStore"
import { CLUSTER_PALETTE, getClusterColor } from "@/types"

export default function Home() {
  const initDemo = useClusterStore((s) => s.initDemo)
  const samples = useClusterStore((s) => s.samples)
  const featureColumns = useClusterStore((s) => s.featureColumns)
  const labelColumns = useClusterStore((s) => s.labelColumns)
  const labelAssignments = useClusterStore((s) => s.labelAssignments)
  const outlierThreshold = useClusterStore((s) => s.outlierThreshold)
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    initDemo()
  }, [initDemo])

  const outlierCount = samples.filter((s) => s.isOutlier).length
  const primaryLabel = labelColumns.find((l) => l.isPrimary) ?? labelColumns[0]
  const uniqueClusters = primaryLabel
    ? Array.from(
        new Set(
          labelAssignments
            .filter((la) => la.columnId === primaryLabel.id)
            .map((la) => la.clusterId)
        )
      ).sort((a, b) => a - b)
    : []

  return (
    <div className="w-full h-full flex flex-col bg-space-bg text-space-text overflow-hidden">
      <header className="h-14 px-6 flex items-center justify-between border-b border-space-border bg-space-panel/50 backdrop-blur-sm flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center shadow-glow-cyan">
            <Layers size={16} className="text-space-dark" />
          </div>
          <div>
            <h1 className="font-display text-base font-bold leading-none">高维聚类投影舱</h1>
            <p className="text-[10px] text-space-muted font-body mt-0.5">High-Dimensional Clustering Projection Pod</p>
          </div>
        </div>

        {samples.length > 0 && (
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-[11px] font-body">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                <span className="text-space-dim">样本</span>
                <span className="text-space-text font-semibold">{samples.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-purple" />
                <span className="text-space-dim">特征</span>
                <span className="text-space-text font-semibold">
                  {featureColumns.filter((f) => f.selected).length}/{featureColumns.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-amber" />
                <span className="text-space-dim">簇</span>
                <span className="text-space-text font-semibold">{uniqueClusters.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-red" />
                <span className="text-space-dim">离群</span>
                <span className="text-space-text font-semibold">{outlierCount}</span>
              </div>
            </div>

            <button
              onClick={() => setShowStats(!showStats)}
              className="text-space-dim hover:text-accent-cyan transition-colors p-1.5 rounded hover:bg-space-dark"
              title="显示统计信息"
            >
              <Info size={16} />
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="p-3 flex-shrink-0">
          <FeaturePanel />
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative">
          {showStats && samples.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-space-panel/95 backdrop-blur-sm rounded-xl border border-space-border px-5 py-3 shadow-xl">
              <div className="text-[10px] font-body text-space-muted mb-2">实时投影统计</div>
              <div className="flex items-center gap-4 text-[11px] font-body">
                <div>
                  <span className="text-space-dim">离群阈值: </span>
                  <span className="text-accent-cyan font-semibold">{outlierThreshold.toFixed(1)}σ</span>
                </div>
                <div>
                  <span className="text-space-dim">离群率: </span>
                  <span className="text-accent-amber font-semibold">
                    {((outlierCount / samples.length) * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-space-dim">簇分布: </span>
                  {uniqueClusters.map((cid) => {
                    const count = labelAssignments.filter(
                      (la) => la.columnId === primaryLabel?.id && la.clusterId === cid
                    ).length
                    return (
                      <span
                        key={cid}
                        className="inline-flex items-center gap-1 ml-2"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getClusterColor(cid) }}
                        />
                        <span className="text-space-text">{count}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 z-10 w-[340px] space-y-3">
            <div className="p-0">
              <DataUploader />
            </div>
            <BatchRecords />
          </div>

          <div className="flex-1 relative">
            {samples.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-space-panel flex items-center justify-center border border-space-border">
                    <Layers size={28} className="text-accent-cyan opacity-50" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-space-text mb-1">等待数据</h3>
                  <p className="text-xs font-body text-space-muted">
                    上传 CSV 数据文件或点击"加载演示数据"开始
                  </p>
                </div>
              </div>
            ) : (
              <Scene3D />
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-10">
            <HistoryTimeline />
          </div>
        </div>

        <div className="w-[320px] p-3 flex-shrink-0 hidden lg:block">
          <div className="h-full rounded-xl border border-space-border overflow-hidden">
            <OutlierPanel />
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <button className="w-12 h-12 rounded-full bg-accent-cyan text-space-dark flex items-center justify-center shadow-glow-cyan">
          <Maximize2 size={20} />
        </button>
      </div>
    </div>
  )
}
