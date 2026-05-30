import { useMemo } from 'react'
import { Download, FileText, FileJson, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { exportCSV, exportJSON, exportFullReport } from '@/utils/export'

export default function ExportPanel() {
  const filteredCurves = useAnalysisStore((s) => s.filteredCurves)
  const clusterResult = useAnalysisStore((s) => s.clusterResult)
  const conflicts = useAnalysisStore((s) => s.conflicts)
  const filterState = useAnalysisStore((s) => s.filterState)
  const alignmentParams = useAnalysisStore((s) => s.alignmentParams)

  const isFilterActive = useMemo(() => {
    return (
      filterState.selectedBatches.length > 0 ||
      filterState.selectedDevices.length > 0 ||
      filterState.selectedAnomalyTypes.length > 0 ||
      filterState.selectedFractureTypes.length > 0
    )
  }, [filterState])

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (filterState.selectedBatches.length > 0) {
      parts.push(`批次 ${filterState.selectedBatches.join(', ')}`)
    }
    if (filterState.selectedDevices.length > 0) {
      parts.push(`设备 ${filterState.selectedDevices.join(', ')}`)
    }
    if (filterState.selectedAnomalyTypes.length > 0) {
      parts.push(`异常类型 ${filterState.selectedAnomalyTypes.join(', ')}`)
    }
    if (filterState.selectedFractureTypes.length > 0) {
      parts.push(`断裂形态 ${filterState.selectedFractureTypes.join(', ')}`)
    }
    return parts
  }, [filterState])

  const clusterCount = clusterResult?.explanations?.length ?? 0

  const handleExportCSV = () => {
    const timestamp = new Date().toISOString().slice(0, 10)
    exportCSV(filteredCurves, `曲线数据_${timestamp}.csv`)
  }

  const handleExportJSON = () => {
    const timestamp = new Date().toISOString().slice(0, 10)
    const report = {
      filterState,
      curves: filteredCurves,
      clusterResult,
      conflicts,
      alignmentParams,
      exportTime: new Date().toISOString(),
    }
    exportJSON(report, `分析数据_${timestamp}.json`)
  }

  const handleExportFullReport = () => {
    exportFullReport(filteredCurves, clusterResult, conflicts, filterState, alignmentParams)
  }

  return (
    <div className={cn('rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 p-5 space-y-5')}>
      <div>
        <h3 className={cn('text-sm font-medium text-slate-200 mb-3')}>当前筛选</h3>
        <div className={cn('rounded-lg bg-[#1B2A4A]/30 border border-[#1B2A4A] px-4 py-3')}>
          {isFilterActive ? (
            <p className={cn('text-sm text-slate-300')}>
              当前筛选: {filterSummary.join(' | ')}
            </p>
          ) : (
            <p className={cn('text-sm text-slate-500')}>无筛选条件，将导出全部数据</p>
          )}
        </div>
      </div>

      <div>
        <h3 className={cn('text-sm font-medium text-slate-200 mb-3')}>数据范围</h3>
        <div className={cn('flex items-center gap-6')}>
          <div className={cn('text-center')}>
            <p className={cn('text-2xl font-semibold text-slate-200')}>{filteredCurves.length}</p>
            <p className={cn('text-xs text-slate-500 mt-0.5')}>条曲线</p>
          </div>
          <div className={cn('w-px h-10 bg-[#1B2A4A]')} />
          <div className={cn('text-center')}>
            <p className={cn('text-2xl font-semibold text-slate-200')}>{clusterCount}</p>
            <p className={cn('text-xs text-slate-500 mt-0.5')}>个聚类</p>
          </div>
          <div className={cn('w-px h-10 bg-[#1B2A4A]')} />
          <div className={cn('text-center')}>
            <p className={cn('text-2xl font-semibold text-[#E8913A]')}>{conflicts.length}</p>
            <p className={cn('text-xs text-slate-500 mt-0.5')}>条冲突记录</p>
          </div>
        </div>
      </div>

      {isFilterActive && (
        <div className={cn('flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3')}>
          <Download className={cn('h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0')} />
          <p className={cn('text-xs text-amber-400')}>当前有筛选条件，仅导出筛选范围内数据</p>
        </div>
      )}

      <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3')}>
        <button
          onClick={handleExportCSV}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
            'bg-[#1B2A4A] border border-[#2A3F6A] text-slate-200',
            'hover:bg-[#2A3F6A] hover:border-[#3B5299] active:scale-[0.98]',
            'transition-all duration-150 text-sm font-medium'
          )}
        >
          <FileSpreadsheet className={cn('h-4 w-4 text-green-400')} />
          导出CSV
        </button>
        <button
          onClick={handleExportJSON}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
            'bg-[#1B2A4A] border border-[#2A3F6A] text-slate-200',
            'hover:bg-[#2A3F6A] hover:border-[#3B5299] active:scale-[0.98]',
            'transition-all duration-150 text-sm font-medium'
          )}
        >
          <FileJson className={cn('h-4 w-4 text-blue-400')} />
          导出JSON
        </button>
        <button
          onClick={handleExportFullReport}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
            'bg-[#E8913A]/15 border border-[#E8913A]/30 text-[#E8913A]',
            'hover:bg-[#E8913A]/25 hover:border-[#E8913A]/50 active:scale-[0.98]',
            'transition-all duration-150 text-sm font-medium'
          )}
        >
          <FileText className={cn('h-4 w-4')} />
          导出完整报告
        </button>
      </div>
    </div>
  )
}
