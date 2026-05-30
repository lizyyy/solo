import BatchComparison from '@/components/BatchComparison'
import ConflictTable from '@/components/ConflictTable'
import ExportPanel from '@/components/ExportPanel'
import { useAnalysisStore } from '@/store/useAnalysisStore'

export default function BatchCompare() {
  const filteredCurves = useAnalysisStore((s) => s.filteredCurves)

  if (filteredCurves.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-[#64748B]">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3h5v5" />
          <path d="M21 3l-7 7" />
          <path d="M8 21H3v-5" />
          <path d="M3 21l7-7" />
        </svg>
        <p className="text-sm">请先在数据总览页导入数据</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-8">
          <div className="mb-6 flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E8913A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" />
              <path d="M21 3l-7 7" />
              <path d="M8 21H3v-5" />
              <path d="M3 21l7-7" />
            </svg>
            <h1 className="text-xl font-semibold text-white">批次对比</h1>
          </div>

          <div className="space-y-6">
            <BatchComparison />
            <ConflictTable />
            <ExportPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
