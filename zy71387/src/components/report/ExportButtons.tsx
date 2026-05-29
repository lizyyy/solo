import { Loader2, Download } from 'lucide-react'
import { useReportStore } from '@/store/useReportStore'
import { useRiskStore } from '@/store/useRiskStore'
import { useLineageStore } from '@/store/useLineageStore'

export default function ExportButtons() {
  const isGenerating = useReportStore((s) => s.isGenerating)
  const currentReport = useReportStore((s) => s.currentReport)
  const generate = useReportStore((s) => s.generate)
  const exportPDF = useReportStore((s) => s.exportPDF)
  const exportExcel = useReportStore((s) => s.exportExcel)

  const handleGenerate = () => {
    const risks = useRiskStore.getState().risks
    const changeOrders = useLineageStore.getState().changeOrders
    generate(risks, changeOrders)
  }

  return (
    <div className="flex gap-3 mb-4">
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="bg-accent text-base-900 font-bold px-4 py-2 rounded text-sm flex items-center gap-2 transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            生成中...
          </>
        ) : (
          '生成巡检报告'
        )}
      </button>
      <button
        onClick={exportPDF}
        disabled={!currentReport}
        className="border border-accent text-accent hover:bg-accent hover:text-base-900 px-4 py-2 rounded text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-accent"
      >
        <Download size={16} />
        导出PDF
      </button>
      <button
        onClick={exportExcel}
        disabled={!currentReport}
        className="border border-accent text-accent hover:bg-accent hover:text-base-900 px-4 py-2 rounded text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-accent"
      >
        <Download size={16} />
        导出Excel
      </button>
    </div>
  )
}
