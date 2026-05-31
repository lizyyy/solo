import { useEffect, useState } from "react"
import { useInspectionStore } from "@/store/useInspectionStore"
import ReportSection from "@/components/ReportSection"
import GuidePanel from "@/components/GuidePanel"
import ExportModal from "@/components/ExportModal"
import { FileText, Download } from "lucide-react"

export default function ReportPage() {
  const { loadMockData, dataLoaded, getTimelineEvents } = useInspectionStore()
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    if (!dataLoaded) loadMockData()
  }, [dataLoaded, loadMockData])

  const events = getTimelineEvents()

  return (
    <div className="h-full">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-700" />
            <h1 className="text-lg font-semibold text-slate-800">巡检报告</h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
              共 {events.length} 条记录
            </span>
          </div>
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            导出报告
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        <ReportSection />
        <GuidePanel />
      </div>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
