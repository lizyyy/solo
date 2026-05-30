import { Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/useAnalysisStore'

const CLUSTER_COLORS = [
  '#4A90D9',
  '#E8913A',
  '#50C878',
  '#D94A4A',
  '#9B59B6',
  '#F1C40F',
  '#1ABC9C',
  '#E74C3C',
]

export default function ClusterExplanation() {
  const { clusterResult, selectedClusterId, setSelectedClusterId } =
    useAnalysisStore()

  if (!clusterResult) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-[#4A90D9]" />
          <h3 className="text-sm font-semibold text-[#E2E8F0]">簇解释</h3>
        </div>
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80">
          <Info className="h-8 w-8 text-[#1B2A4A]" />
          <p className="text-sm text-[#64748B]">暂无簇解释信息</p>
          <p className="text-xs text-[#475569]">执行聚类后查看各簇详细分析</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Info className="h-5 w-5 text-[#4A90D9]" />
        <h3 className="text-sm font-semibold text-[#E2E8F0]">簇解释</h3>
        <span className="rounded-full bg-[#1B2A4A] px-2 py-0.5 text-xs text-[#94A3B8]">
          {clusterResult.explanations.length} 个簇
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {clusterResult.explanations.map((exp) => {
          const color = CLUSTER_COLORS[exp.clusterId % CLUSTER_COLORS.length]
          const isActive = selectedClusterId === exp.clusterId
          const anomalyPercent = Math.round(exp.anomalyRatio * 100)

          return (
            <button
              key={exp.clusterId}
              onClick={() =>
                setSelectedClusterId(
                  isActive ? null : exp.clusterId
                )
              }
              className={cn(
                'group w-full rounded-xl border bg-[#0F1923]/80 p-3.5 text-left transition-all',
                isActive
                  ? 'border-[#E8913A] shadow-lg shadow-[#E8913A]/10'
                  : 'border-[#1B2A4A] hover:border-[#4A90D9]/40'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#E2E8F0]">
                        簇 {exp.clusterId}
                      </span>
                      <span className="rounded bg-[#1B2A4A] px-1.5 py-0.5 text-[10px] text-[#94A3B8]">
                        {exp.count} 样本
                      </span>
                    </div>
                    {anomalyPercent > 50 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#64748B]">平均断裂强度</span>
                      <span className="text-xs font-medium text-[#E2E8F0]">
                        {exp.avgFractureStrength}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#64748B]">主导断裂类型</span>
                      <span className="text-xs font-medium text-[#E2E8F0]">
                        {exp.dominantFractureType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#64748B]">主导批次</span>
                      <span className="text-xs font-medium text-[#E2E8F0]">
                        {exp.dominantBatch}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#64748B]">异常比例</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          anomalyPercent > 50
                            ? 'text-red-400'
                            : anomalyPercent > 20
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        )}
                      >
                        {anomalyPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#1B2A4A]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        anomalyPercent > 50
                          ? 'bg-red-500'
                          : anomalyPercent > 20
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      )}
                      style={{ width: `${anomalyPercent}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
                    {exp.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
