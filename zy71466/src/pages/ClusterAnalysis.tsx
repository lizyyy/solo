import AlignmentControls from '@/components/AlignmentControls'
import ClusterChart from '@/components/ClusterChart'
import ClusterExplanation from '@/components/ClusterExplanation'
import CurveDetail from '@/components/CurveDetail'
import { useAnalysisStore } from '@/store/useAnalysisStore'

export default function ClusterAnalysis() {
  const filteredCurves = useAnalysisStore((s) => s.filteredCurves)
  const selectedCurveId = useAnalysisStore((s) => s.selectedCurveId)

  if (filteredCurves.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-[#64748B]">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <p className="text-sm">请先在数据总览页导入数据</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-8">
          <div className="mb-6 flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="7.5" r="3" />
              <circle cx="16.5" cy="7.5" r="3" />
              <circle cx="12" cy="16.5" r="3" />
            </svg>
            <h1 className="text-xl font-semibold text-white">聚类分析</h1>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <AlignmentControls />
            </div>
            <div className="col-span-9">
              <ClusterChart />
            </div>
          </div>

          <div className="mt-6">
            <ClusterExplanation />
          </div>
        </div>
      </div>
      {selectedCurveId && <CurveDetail />}
    </div>
  )
}
