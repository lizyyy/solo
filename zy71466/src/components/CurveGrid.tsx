import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { cn } from '@/lib/utils'
import type { TensileCurve } from '@/types'

const CLUSTER_PALETTE = [
  '#5B8FF9', '#5AD8A6', '#F6BD16', '#E86452',
  '#6DC8EC', '#945FB9', '#FF9845', '#1E9493',
]

function buildMiniOption(curve: TensileCurve) {
  const strain = curve.alignedStrain ?? curve.strain
  const stress = curve.alignedStress ?? curve.stress
  const lineColor = curve.isAnomaly ? '#E8913A' : '#4A7AB5'

  return {
    animation: false,
    grid: { top: 4, right: 4, bottom: 4, left: 4 },
    xAxis: { show: false, type: 'value' as const, min: 'dataMin' as const, max: 'dataMax' as const },
    yAxis: { show: false, type: 'value' as const, min: 'dataMin' as const, max: 'dataMax' as const },
    series: [
      {
        type: 'line' as const,
        data: strain.map((s: number, i: number) => [s, stress[i]]),
        showSymbol: false,
        lineStyle: { width: 1.5, color: lineColor },
        itemStyle: { color: lineColor },
        smooth: 0.2,
      },
    ],
    tooltip: { show: false },
  }
}

const CurveCard = React.memo(function CurveCard({
  curve,
  isSelected,
  onClick,
}: {
  curve: TensileCurve
  isSelected: boolean
  onClick: () => void
}) {
  const option = useMemo(() => buildMiniOption(curve), [curve])

  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg bg-[#0F1923] border transition-all duration-200 overflow-hidden',
        'hover:shadow-lg hover:shadow-[#1B2A4A]/20 hover:scale-[1.02]',
        curve.isAnomaly
          ? 'border-l-[3px] border-l-[#E8913A] border-y border-r border-y-[#3A4A5C]/30 border-r-[#3A4A5C]/30'
          : 'border-l-[3px] border-l-[#1B2A4A] border-y border-r border-y-[#3A4A5C]/30 border-r-[#3A4A5C]/30',
        isSelected && 'ring-2 ring-[#E8913A] ring-offset-1 ring-offset-[#0F1923]',
      )}
    >
      <ReactECharts option={option} style={{ height: 96 }} opts={{ renderer: 'svg' }} />
      <div className="px-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          {curve.clusterId !== undefined && (
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CLUSTER_PALETTE[curve.clusterId % CLUSTER_PALETTE.length] }}
            />
          )}
          <span className="text-[11px] text-[#8A9AB5] truncate">{curve.sampleId}</span>
        </div>
        <div className="text-[10px] text-[#3A4A5C] truncate mt-0.5">
          {curve.batchNo} · {curve.deviceId}
        </div>
      </div>
    </div>
  )
})

export default function CurveGrid() {
  const filteredCurves = useAnalysisStore((s) => s.filteredCurves)
  const selectedCurveId = useAnalysisStore((s) => s.selectedCurveId)
  const setSelectedCurveId = useAnalysisStore((s) => s.setSelectedCurveId)

  if (filteredCurves.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[#3A4A5C]">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
        <span className="text-sm">暂无曲线数据</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 p-3">
      {filteredCurves.map((curve) => (
        <CurveCard
          key={curve.id}
          curve={curve}
          isSelected={curve.id === selectedCurveId}
          onClick={() => setSelectedCurveId(curve.id)}
        />
      ))}
    </div>
  )
}
