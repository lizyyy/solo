import DataImport from '@/components/DataImport'
import FilterPanel from '@/components/FilterPanel'
import CurveGrid from '@/components/CurveGrid'
import CurveDetail from '@/components/CurveDetail'
import { useAnalysisStore } from '@/store/useAnalysisStore'

export default function DataOverview() {
  const filteredCurves = useAnalysisStore((s) => s.filteredCurves)
  const selectedCurveId = useAnalysisStore((s) => s.selectedCurveId)

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-8">
          <DataImport />
          {filteredCurves.length > 0 && (
            <div className="mt-6">
              <FilterPanel />
            </div>
          )}
          {filteredCurves.length > 0 && (
            <div className="mt-6">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#E2E8F0]">曲线预览</h2>
                <span className="rounded-full bg-[#1B2A4A] px-2 py-0.5 text-[10px] text-[#94A3B8]">
                  {filteredCurves.length} 条
                </span>
              </div>
              <CurveGrid />
            </div>
          )}
        </div>
      </div>
      {selectedCurveId && <CurveDetail />}
    </div>
  )
}
