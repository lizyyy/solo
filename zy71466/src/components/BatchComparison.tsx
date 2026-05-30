import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { BarChart3, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import type { TensileCurve } from '@/types'

interface BatchRow {
  batchNo: string
  total: number
  anomalyCount: number
  anomalyRatio: number
  avgMaxStress: number
  deviceCount: number
}

export default function BatchComparison() {
  const filteredCurves = useAnalysisStore((s) => s.filteredCurves)
  const filterState = useAnalysisStore((s) => s.filterState)
  const setFilterState = useAnalysisStore((s) => s.setFilterState)
  const applyFilter = useAnalysisStore((s) => s.applyFilter)

  const batchRows: BatchRow[] = useMemo(() => {
    const map = new Map<string, TensileCurve[]>()
    filteredCurves.forEach((c) => {
      if (!map.has(c.batchNo)) map.set(c.batchNo, [])
      map.get(c.batchNo)!.push(c)
    })
    return Array.from(map.entries()).map(([batchNo, curves]) => {
      const anomalyCount = curves.filter((c) => c.isAnomaly).length
      const maxStresses = curves.map((c) => Math.max(...c.stress))
      const avgMaxStress = maxStresses.length > 0 ? maxStresses.reduce((a, b) => a + b, 0) / maxStresses.length : 0
      return {
        batchNo,
        total: curves.length,
        anomalyCount,
        anomalyRatio: curves.length > 0 ? anomalyCount / curves.length : 0,
        avgMaxStress,
        deviceCount: new Set(curves.map((c) => c.deviceId)).size,
      }
    })
  }, [filteredCurves])

  const barOption = useMemo(() => {
    const batches = batchRows.map((r) => r.batchNo)
    const normalCounts = batchRows.map((r) => r.total - r.anomalyCount)
    const anomalyCounts = batchRows.map((r) => r.anomalyCount)
    return {
      tooltip: { trigger: 'axis' as const, backgroundColor: '#1B2A4A', borderColor: '#2A3F6A', textStyle: { color: '#E2E8F0' } },
      legend: { data: ['正常', '异常'], textStyle: { color: '#94A3B8' }, top: 0 },
      grid: { left: 48, right: 16, top: 40, bottom: 32 },
      xAxis: { type: 'category' as const, data: batches, axisLabel: { color: '#94A3B8', fontSize: 11 }, axisLine: { lineStyle: { color: '#2A3F6A' } } },
      yAxis: { type: 'value' as const, axisLabel: { color: '#94A3B8' }, axisLine: { lineStyle: { color: '#2A3F6A' } }, splitLine: { lineStyle: { color: '#1B2A4A' } } },
      series: [
        { name: '正常', type: 'bar', stack: 'total', data: normalCounts, itemStyle: { color: '#3B82F6', borderRadius: [0, 0, 0, 0] } },
        { name: '异常', type: 'bar', stack: 'total', data: anomalyCounts, itemStyle: { color: '#E8913A', borderRadius: [4, 4, 0, 0] } },
      ],
    }
  }, [batchRows])

  const pieOption = useMemo(() => {
    const deviceMap = new Map<string, number>()
    filteredCurves.filter((c) => c.isAnomaly).forEach((c) => {
      deviceMap.set(c.deviceId, (deviceMap.get(c.deviceId) || 0) + 1)
    })
    const data = Array.from(deviceMap.entries()).map(([name, value]) => ({ name, value }))
    return {
      tooltip: { trigger: 'item' as const, backgroundColor: '#1B2A4A', borderColor: '#2A3F6A', textStyle: { color: '#E2E8F0' } },
      legend: { orient: 'vertical' as const, right: 8, top: 'center', textStyle: { color: '#94A3B8', fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#E2E8F0' } },
        data,
        itemStyle: {
          color: (_params: { dataIndex: number }) => {
            const palette = ['#E8913A', '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F']
            return palette[_params.dataIndex % palette.length]
          },
          borderColor: '#0F1923',
          borderWidth: 2,
        },
      }],
    }
  }, [filteredCurves])

  const handleBatchClick = (batchNo: string) => {
    const newBatches = filterState.selectedBatches.includes(batchNo)
      ? filterState.selectedBatches
      : [batchNo]
    setFilterState({ ...filterState, selectedBatches: newBatches })
    applyFilter()
  }

  if (filteredCurves.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-20 text-slate-400')}>
        <BarChart3 className={cn('h-12 w-12 mb-3 opacity-40')} />
        <p className={cn('text-sm')}>暂无批次对比数据</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6')}>
      <div className={cn('rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 overflow-hidden')}>
        <div className={cn('flex items-center gap-2 px-5 py-3 border-b border-[#1B2A4A]')}>
          <BarChart3 className={cn('h-4 w-4 text-[#E8913A]')} />
          <h3 className={cn('text-sm font-medium text-slate-200')}>批次汇总</h3>
        </div>
        <div className={cn('overflow-x-auto')}>
          <table className={cn('w-full text-sm')}>
            <thead>
              <tr className={cn('bg-[#1B2A4A]/40')}>
                <th className={cn('px-4 py-2.5 text-left text-slate-400 font-medium')}>批次</th>
                <th className={cn('px-4 py-2.5 text-right text-slate-400 font-medium')}>样品数</th>
                <th className={cn('px-4 py-2.5 text-right text-slate-400 font-medium')}>异常数</th>
                <th className={cn('px-4 py-2.5 text-right text-slate-400 font-medium')}>异常比例</th>
                <th className={cn('px-4 py-2.5 text-right text-slate-400 font-medium')}>平均最大应力</th>
                <th className={cn('px-4 py-2.5 text-right text-slate-400 font-medium')}>涉及设备数</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.map((row) => (
                <tr
                  key={row.batchNo}
                  onClick={() => handleBatchClick(row.batchNo)}
                  className={cn(
                    'cursor-pointer border-b border-[#1B2A4A]/50 transition-colors duration-150',
                    'hover:bg-[#1B2A4A]/30',
                    filterState.selectedBatches.includes(row.batchNo) && 'bg-[#1B2A4A]/40'
                  )}
                >
                  <td className={cn('px-4 py-2.5 text-slate-200 font-medium')}>{row.batchNo}</td>
                  <td className={cn('px-4 py-2.5 text-right text-slate-300')}>{row.total}</td>
                  <td className={cn('px-4 py-2.5 text-right text-[#E8913A]')}>{row.anomalyCount}</td>
                  <td className={cn('px-4 py-2.5 text-right text-slate-300')}>
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      row.anomalyRatio > 0.3 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    )}>
                      {(row.anomalyRatio * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className={cn('px-4 py-2.5 text-right text-slate-300')}>{row.avgMaxStress.toFixed(2)}</td>
                  <td className={cn('px-4 py-2.5 text-right text-slate-300')}>{row.deviceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-6')}>
        <div className={cn('rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 p-4')}>
          <div className={cn('flex items-center gap-2 mb-3')}>
            <BarChart3 className={cn('h-4 w-4 text-[#E8913A]')} />
            <h3 className={cn('text-sm font-medium text-slate-200')}>批次异常分布</h3>
          </div>
          <ReactECharts option={barOption} style={{ height: 280 }} />
        </div>
        <div className={cn('rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 p-4')}>
          <div className={cn('flex items-center gap-2 mb-3')}>
            <PieChart className={cn('h-4 w-4 text-[#E8913A]')} />
            <h3 className={cn('text-sm font-medium text-slate-200')}>设备异常占比</h3>
          </div>
          <ReactECharts option={pieOption} style={{ height: 280 }} />
        </div>
      </div>
    </div>
  )
}
