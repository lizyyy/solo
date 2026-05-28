import { useEffect, useMemo } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import { buildTreeData, calcSummary } from '@/utils/hedgingCalc'
import TreeScene from '@/components/tree3d/TreeScene'
import SummaryCards from '@/components/panels/SummaryCards'
import SnapshotList from '@/components/review/SnapshotList'
import ExportBar from '@/components/review/ExportBar'

export default function ReviewPage() {
  const subsidiaries = useExposureStore((s) => s.subsidiaries)
  const currencies = useExposureStore((s) => s.currencies)
  const exposures = useExposureStore((s) => s.exposures)
  const hedgeContracts = useExposureStore((s) => s.hedgeContracts)
  const selectedCurrencies = useExposureStore((s) => s.selectedCurrencies)
  const selectedSubsidiaryCodes = useExposureStore((s) => s.selectedSubsidiaryCodes)
  const selectedDirections = useExposureStore((s) => s.selectedDirections)
  const dataLoaded = useExposureStore((s) => s.dataLoaded)
  const loadSnapshots = useSnapshotStore((s) => s.loadSnapshots)

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const treeData = useMemo(
    () => buildTreeData(subsidiaries, currencies, exposures, hedgeContracts, selectedCurrencies, selectedSubsidiaryCodes, selectedDirections),
    [subsidiaries, currencies, exposures, hedgeContracts, selectedCurrencies, selectedSubsidiaryCodes, selectedDirections]
  )

  const summary = useMemo(() => calcSummary(exposures, hedgeContracts), [exposures, hedgeContracts])

  return (
    <div className="h-full flex">
      <div className="flex-1 relative">
        {dataLoaded ? (
          <TreeScene treeData={treeData} />
        ) : (
          <div className="h-full flex items-center justify-center text-txt-muted text-sm">
            请先加载快照或导入数据
          </div>
        )}
      </div>
      <div className="w-[400px] border-l border-border bg-panel flex flex-col">
        <div className="p-4 border-b border-border">
          <SummaryCards summary={summary} />
        </div>
        <div className="flex-1 overflow-auto p-4">
          <SnapshotList />
        </div>
        <div className="p-4 border-t border-border space-y-3">
          <div>
            <div className="text-xs text-txt-secondary mb-2 font-medium">数据概览</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="card py-2">
                <div className="text-lg font-mono font-bold text-accent-green">{exposures.length}</div>
                <div className="text-xs text-txt-muted">敞口</div>
              </div>
              <div className="card py-2">
                <div className="text-lg font-mono font-bold text-accent-gold">{hedgeContracts.length}</div>
                <div className="text-xs text-txt-muted">套保</div>
              </div>
              <div className="card py-2">
                <div className="text-lg font-mono font-bold text-accent-blue">{subsidiaries.length}</div>
                <div className="text-xs text-txt-muted">子公司</div>
              </div>
            </div>
          </div>
          <ExportBar />
        </div>
      </div>
    </div>
  )
}
