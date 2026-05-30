import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { X, AlertTriangle } from 'lucide-react'
import { useAnalysisStore } from '@/store/useAnalysisStore'

export default function CurveDetail() {
  const { filteredCurves, selectedCurveId, conflicts, setSelectedCurveId } = useAnalysisStore()

  const curve = useMemo(
    () => filteredCurves.find((c) => c.id === selectedCurveId) ?? null,
    [filteredCurves, selectedCurveId]
  )

  const curveConflicts = useMemo(
    () => (curve ? conflicts.filter((c) => c.curveId === curve.id) : []),
    [curve, conflicts]
  )

  const chartOption = useMemo(() => {
    if (!curve) return null
    const strain = curve.alignedStrain ?? curve.strain
    const stress = curve.alignedStress ?? curve.stress
    return {
      backgroundColor: 'transparent',
      grid: { left: 56, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'value' as const,
        name: '应变',
        nameTextStyle: { color: '#94A3B8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#1B2A4A' } },
        axisLabel: { color: '#64748B', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(27,42,74,0.4)' } },
      },
      yAxis: {
        type: 'value' as const,
        name: '应力 (MPa)',
        nameTextStyle: { color: '#94A3B8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#1B2A4A' } },
        axisLabel: { color: '#64748B', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(27,42,74,0.4)' } },
      },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(15, 25, 35, 0.95)',
        borderColor: '#1B2A4A',
        textStyle: { color: '#E2E8F0', fontSize: 12 },
      },
      series: [
        {
          type: 'line' as const,
          data: strain.map((s: number, i: number) => [s, stress[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: curve.isAnomaly ? '#E8913A' : '#4A90D9' },
          itemStyle: { color: curve.isAnomaly ? '#E8913A' : '#4A90D9' },
          smooth: 0.2,
        },
      ],
    }
  }, [curve])

  if (!curve) return null

  const maxStress = Math.max(...curve.stress)
  const maxStrain = Math.max(...curve.strain)

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-[#1B2A4A] bg-[#0F1923] shadow-2xl shadow-black/50 transition-transform duration-300"
      style={{ transform: curve ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[#1B2A4A] px-5 py-3">
          <h3 className="text-sm font-semibold text-[#E2E8F0]">曲线明细</h3>
          <button
            onClick={() => setSelectedCurveId(null)}
            className="rounded-md p-1 text-[#64748B] transition-colors hover:bg-[#1B2A4A] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 p-3">
            {chartOption && (
              <ReactECharts option={chartOption} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />
            )}
          </div>

          <div className="mb-5 space-y-2.5">
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">样品编号</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{curve.sampleId}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">批次</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{curve.batchNo}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">设备编号</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{curve.deviceId}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">断裂形态</span>
              <span className="text-sm text-[#E2E8F0]">{curve.fractureType || '未知'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">是否异常</span>
              {curve.isAnomaly ? (
                <span className="flex items-center gap-1.5 rounded-full bg-[#E8913A]/15 px-2.5 py-0.5 text-xs font-medium text-[#E8913A]">
                  <AlertTriangle size={12} />
                  异常
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">正常</span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">聚类编号</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{curve.clusterId !== undefined ? `簇 ${curve.clusterId}` : '—'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">最大应力</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{maxStress.toFixed(2)} MPa</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">最大应变</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{maxStrain.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#1B2A4A]/30 px-4 py-2.5">
              <span className="text-xs text-[#94A3B8]">数据点数</span>
              <span className="font-mono text-sm text-[#E2E8F0]">{curve.strain.length}</span>
            </div>
          </div>

          {curveConflicts.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#E8913A]">
                <AlertTriangle size={14} />
                冲突记录 ({curveConflicts.length})
              </h4>
              <div className="space-y-2">
                {curveConflicts.map((conflict, i) => (
                  <div key={i} className="rounded-lg border border-[#E8913A]/20 bg-[#E8913A]/5 p-3">
                    <p className="mb-1 text-xs text-[#E8913A]">{conflict.description}</p>
                    <p className="text-[11px] text-[#94A3B8]">建议: {conflict.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
