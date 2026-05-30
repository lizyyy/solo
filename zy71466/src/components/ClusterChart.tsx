import { useState, useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { ScatterChart, Play, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { performClustering } from '@/utils/clustering'
import { detectConflicts } from '@/utils/conflict'
import { alignCurves } from '@/utils/alignment'

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

export default function ClusterChart() {
  const {
    filteredCurves,
    clusterResult,
    alignmentParams,
    selectedClusterId,
    isAnalyzing,
    setClusterResult,
    setConflicts,
    setSelectedCurveId,
    setIsAnalyzing,
  } = useAnalysisStore()

  const [k, setK] = useState(3)
  const [alignmentWarning, setAlignmentWarning] = useState(false)

  const needsAlignment = useMemo(
    () => filteredCurves.some((c) => !c.alignedStress),
    [filteredCurves]
  )

  const handleClustering = useCallback(() => {
    if (filteredCurves.length === 0) return

    if (needsAlignment) {
      setAlignmentWarning(true)
      const aligned = alignCurves(
        filteredCurves,
        alignmentParams.mode,
        alignmentParams.targetLength
      )
      const updated = filteredCurves.map((c, i) => ({
        ...c,
        alignedStrain: aligned[i].alignedStrain,
        alignedStress: aligned[i].alignedStress,
      }))
      useAnalysisStore.getState().setFilteredCurves(updated)
      setIsAnalyzing(true)
      setTimeout(() => {
        const result = performClustering(updated, k)
        const updatedWithLabels = updated.map((c, i) => ({
          ...c,
          clusterId: result.labels[i],
        }))
        useAnalysisStore.getState().setFilteredCurves(updatedWithLabels)
        setClusterResult(result)
        const conflicts = detectConflicts(updatedWithLabels)
        setConflicts(conflicts)
        setIsAnalyzing(false)
        setAlignmentWarning(false)
      }, 0)
    } else {
      setIsAnalyzing(true)
      setTimeout(() => {
        const result = performClustering(filteredCurves, k)
        const updated = filteredCurves.map((c, i) => ({
          ...c,
          clusterId: result.labels[i],
        }))
        useAnalysisStore.getState().setFilteredCurves(updated)
        setClusterResult(result)
        const conflicts = detectConflicts(updated)
        setConflicts(conflicts)
        setIsAnalyzing(false)
      }, 0)
    }
  }, [filteredCurves, k, needsAlignment, alignmentParams, setClusterResult, setConflicts, setIsAnalyzing])

  const chartOption = useMemo(() => {
    if (!clusterResult || filteredCurves.length === 0) return null

    const seriesData: Record<number, number[][]> = {}
    for (let i = 0; i < clusterResult.k; i++) {
      seriesData[i] = []
    }

    clusterResult.pcaCoords.forEach((coord, idx) => {
      const label = clusterResult.labels[idx]
      if (seriesData[label]) {
        seriesData[label].push([coord[0], coord[1], idx])
      }
    })

    const series = Object.entries(seriesData).map(([labelStr, data]) => {
      const label = Number(labelStr)
      return {
        name: `簇 ${label}`,
        type: 'scatter' as const,
        data: data.map((d) => ({
          value: [d[0], d[1]],
          _curveIdx: d[2],
        })),
        itemStyle: {
          color: CLUSTER_COLORS[label % CLUSTER_COLORS.length],
          borderColor:
            selectedClusterId === label
              ? '#E8913A'
              : 'transparent',
          borderWidth: selectedClusterId === label ? 3 : 0,
        },
        symbolSize: selectedClusterId === null || selectedClusterId === label ? 12 : 6,
        emphasis: {
          itemStyle: {
            borderColor: '#E8913A',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(232, 145, 58, 0.5)',
          },
          scale: 1.5,
        },
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(15, 25, 35, 0.95)',
        borderColor: '#1B2A4A',
        borderWidth: 1,
        textStyle: { color: '#E2E8F0', fontSize: 12 },
        formatter: (params: { seriesName: string; dataIndex: number; value: number[] }) => {
          const sIdx = series[Number(params.seriesName.replace('簇 ', '')) - 0]
          if (!sIdx) return ''
          const curveIdx = sIdx.data[params.dataIndex]?._curveIdx
          if (curveIdx == null) return ''
          const curve = filteredCurves[curveIdx]
          if (!curve) return ''
          return `<div style="padding:2px 4px">
            <div style="font-weight:600;margin-bottom:4px">${curve.sampleId}</div>
            <div>批次: ${curve.batchNo}</div>
            <div>设备: ${curve.deviceId}</div>
          </div>`
        },
      },
      legend: {
        type: 'scroll' as const,
        bottom: 0,
        textStyle: { color: '#94A3B8', fontSize: 11 },
        pageTextStyle: { color: '#94A3B8' },
        pageIconColor: '#E8913A',
        pageIconInactiveColor: '#475569',
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: {
        left: 10,
        right: 20,
        top: 10,
        bottom: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'value' as const,
        name: 'PC1',
        nameTextStyle: { color: '#64748B', fontSize: 11 },
        axisLine: { lineStyle: { color: '#1B2A4A' } },
        axisLabel: { color: '#64748B', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(27,42,74,0.4)' } },
      },
      yAxis: {
        type: 'value' as const,
        name: 'PC2',
        nameTextStyle: { color: '#64748B', fontSize: 11 },
        axisLine: { lineStyle: { color: '#1B2A4A' } },
        axisLabel: { color: '#64748B', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(27,42,74,0.4)' } },
      },
      series,
    }
  }, [clusterResult, filteredCurves, selectedClusterId])

  const handleChartClick = useCallback(
    (params: { componentType: string; seriesName: string; dataIndex: number }) => {
      if (params.componentType !== 'series') return
      const clusterLabel = Number(params.seriesName.replace('簇 ', ''))
      const sData = chartOption?.series?.[clusterLabel]?.data
      if (!sData) return
      const curveIdx = (sData[params.dataIndex] as { _curveIdx: number })._curveIdx
      if (curveIdx != null) {
        const curve = filteredCurves[curveIdx]
        if (curve) setSelectedCurveId(curve.id)
      }
    },
    [chartOption, filteredCurves, setSelectedCurveId]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScatterChart className="h-5 w-5 text-[#4A90D9]" />
          <h3 className="text-sm font-semibold text-[#E2E8F0]">聚类分析</h3>
        </div>
        {clusterResult && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94A3B8]">轮廓系数</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-bold',
                clusterResult.silhouette > 0.5
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : clusterResult.silhouette > 0.25
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
              )}
            >
              {clusterResult.silhouette.toFixed(3)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-3">
          <label className="text-xs text-[#94A3B8] whitespace-nowrap">K值</label>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#1B2A4A] accent-[#E8913A]"
          />
          <span className="min-w-[1.5rem] rounded bg-[#1B2A4A] px-2 py-0.5 text-center text-xs font-bold text-[#E8913A]">
            {k}
          </span>
        </div>
        <button
          onClick={handleClustering}
          disabled={isAnalyzing || filteredCurves.length === 0}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
            isAnalyzing || filteredCurves.length === 0
              ? 'cursor-not-allowed bg-[#1B2A4A]/50 text-[#64748B]'
              : 'bg-[#E8913A] text-white hover:bg-[#d07e2e] active:scale-95'
          )}
        >
          <Play className="h-3.5 w-3.5" />
          {isAnalyzing ? '分析中...' : '执行聚类'}
        </button>
      </div>

      {alignmentWarning && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-xs text-amber-300">
            曲线尚未对齐，正在自动执行对齐处理...
          </span>
        </div>
      )}

      <div className="relative min-h-[360px] rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 p-2">
        {chartOption ? (
          <ReactECharts
            option={chartOption}
            style={{ height: '100%', minHeight: 340 }}
            onEvents={{ click: handleChartClick }}
            opts={{ renderer: 'canvas' }}
          />
        ) : (
          <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-3">
            <ScatterChart className="h-10 w-10 text-[#1B2A4A]" />
            <p className="text-sm text-[#64748B]">暂无聚类结果</p>
            <p className="text-xs text-[#475569]">
              请调整参数后点击「执行聚类」开始分析
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
