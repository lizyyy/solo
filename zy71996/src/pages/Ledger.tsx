import { useState, useMemo } from 'react'
import { useInspectionStore } from '@/store/inspectionStore'
import LedgerColumn from '@/components/LedgerColumn'
import { BookOpen, Download, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { ExportFormat } from '@/types'

export default function Ledger() {
  const showExportModal = useInspectionStore((s) => s.showExportModal)
  const setShowExportModal = useInspectionStore((s) => s.setShowExportModal)
  const showReviewModal = useInspectionStore((s) => s.showReviewModal)
  const setShowReviewModal = useInspectionStore((s) => s.setShowReviewModal)
  const reviewPassed = useInspectionStore((s) => s.reviewPassed)
  const setReviewPassed = useInspectionStore((s) => s.setReviewPassed)
  const ledgerExportFormat = useInspectionStore((s) => s.ledgerExportFormat)
  const setLedgerExportFormat = useInspectionStore((s) => s.setLedgerExportFormat)
  const exportData = useInspectionStore((s) => s.exportData)
  const records = useInspectionStore((s) => s.records)
  const [localFormat, setLocalFormat] = useState<ExportFormat>(ledgerExportFormat)

  const summary = useMemo(() => ({
    total: records.length,
    confirmed: records.filter((r) => r.status === 'confirmed').length,
    pendingSupplement: records.filter((r) => r.status === 'pending_supplement').length,
    manuallyModified: records.filter((r) => r.status === 'manually_modified').length,
  }), [records])

  const handleReviewPass = () => {
    setReviewPassed(true)
    setShowReviewModal(false)
  }

  const handleExport = () => {
    if (!reviewPassed) {
      setShowReviewModal(true)
      return
    }
    setShowExportModal(true)
  }

  const handleDownload = () => {
    const data = exportData()
    if (!data) return

    const blob = new Blob([data], {
      type: localFormat === 'json' ? 'application/json' : 'text/csv',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspection-ledger-${new Date().toISOString().slice(0, 10)}.${localFormat}`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-indigo-950" />
          <h2 className="text-2xl font-bold text-indigo-950">运行账本</h2>
          {reviewPassed && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs rounded-full">
              <CheckCircle2 size={12} />
              已复核
            </span>
          )}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 rounded-lg text-sm font-semibold transition-colors"
        >
          <Download size={16} />
          导出账本
        </button>
      </div>

      <div className="text-xs text-slate-500 mb-4">
        共 {summary.total} 条记录：已确认 {summary.confirmed} · 待补 {summary.pendingSupplement} · 人工改过 {summary.manuallyModified}
      </div>

      <div className="flex gap-4">
        <LedgerColumn
          title="已确认"
          icon={CheckCircle2}
          color="bg-emerald-600"
          status="confirmed"
          emptyText="暂无已确认记录"
        />
        <LedgerColumn
          title="待补材料"
          icon={AlertTriangle}
          color="bg-amber-500"
          status="pending_supplement"
          emptyText="暂无待补记录"
        />
        <LedgerColumn
          title="人工改过"
          icon={AlertTriangle}
          color="bg-rose-600"
          status="manually_modified"
          emptyText="暂无人工改动记录"
        />
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-indigo-950">导出复核</h3>
              <button onClick={() => setShowReviewModal(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p>导出前请确认以下事项：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>所有"待补材料"记录的缺失材料信息是否完整</li>
                <li>所有"人工改过"记录的变更对比是否准确</li>
                <li>处理口径是否与当前值班策略一致</li>
              </ul>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                取消
              </button>
              <button
                onClick={handleReviewPass}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                复核通过
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-indigo-950">选择导出格式</h3>
              <button onClick={() => setShowExportModal(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="flex gap-3 mb-6">
              {(['json', 'csv'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => {
                    setLocalFormat(fmt)
                    setLedgerExportFormat(fmt)
                  }}
                  className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-colors uppercase ${
                    localFormat === fmt
                      ? 'bg-indigo-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                取消
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-indigo-950 rounded-lg text-sm font-semibold transition-colors"
              >
                下载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
