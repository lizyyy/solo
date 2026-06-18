import { useEffect, useState } from 'react'
import { Download, ChevronDown, FileSpreadsheet } from 'lucide-react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import MetricBar from '@/components/MetricBar'
import FilterPanel from '@/components/FilterPanel'
import AnomalyTable from '@/components/AnomalyTable'
import Empty from '@/components/Empty'
import { exportToCSV } from '@/utils/exportData'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const { initialize, anomalies, filter, getFilteredAnomalies } = useAnomalyStore()
  const [showExportMenu, setShowExportMenu] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  const filteredRecords = getFilteredAnomalies()
  const today = new Date().toISOString().slice(0, 10)
  const todayNew = anomalies.filter((a) => a.createdAt.slice(0, 10) === today).length
  const suspendedCount = anomalies.filter((a) => a.status === 'SUSPENDED').length

  const handleExport = (scope: 'filtered' | 'all') => {
    const records = scope === 'filtered' ? filteredRecords : anomalies
    const exportFilter = scope === 'filtered' && filter.applyToExport ? filter : {
      ...filter,
      buoyId: '',
      anomalyType: '' as const,
      status: '' as const,
      dateFrom: '',
      dateTo: '',
      applyToExport: false,
    }
    exportToCSV(records, exportFilter)
    setShowExportMenu(false)
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface font-display">异常队列总览</h1>
          <p className="text-sm text-muted mt-1">
            实时监控浮标海况异常数据，筛选条件已自动保存
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-neon text-ocean-950 font-semibold hover:bg-neon/90 transition-all shadow-lg shadow-neon/20"
          >
            <Download className="w-4 h-4" />
            导出数据
            <ChevronDown className={cn('w-4 h-4 transition-transform', showExportMenu && 'rotate-180')} />
          </button>

          {showExportMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowExportMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-ocean-800 border border-ocean-700 rounded-xl shadow-xl z-20 overflow-hidden">
                <div className="p-3 border-b border-ocean-700">
                  <p className="text-xs text-muted">
                    {filter.applyToExport
                      ? '✓ 导出将携带当前筛选口径'
                      : '筛选口径未应用到导出'}
                  </p>
                </div>
                <button
                  onClick={() => handleExport('filtered')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ocean-700/50 transition-colors"
                >
                  <FileSpreadsheet className="w-5 h-5 text-neon" />
                  <div>
                    <p className="text-surface font-medium">导出当前筛选</p>
                    <p className="text-xs text-muted">共 {filteredRecords.length} 条记录</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('all')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ocean-700/50 transition-colors border-t border-ocean-700"
                >
                  <FileSpreadsheet className="w-5 h-5 text-muted" />
                  <div>
                    <p className="text-surface font-medium">导出全部数据</p>
                    <p className="text-xs text-muted">共 {anomalies.length} 条记录</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <MetricBar
        totalAnomalies={anomalies.length}
        suspendedCount={suspendedCount}
        todayNew={todayNew}
      />

      <FilterPanel />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          显示 <span className="text-surface font-semibold">{filteredRecords.length}</span> 条记录
          {filter.applyToExport && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-neon/10 text-neon">
              口径已绑定导出
            </span>
          )}
        </p>
      </div>

      {filteredRecords.length > 0 ? (
        <AnomalyTable records={filteredRecords} />
      ) : (
        <Empty description="尝试调整筛选条件或导入新的船上记录" />
      )}
    </div>
  )
}
