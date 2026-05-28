import { useMemo, useState } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { buildTreeData, calcSummary } from '@/utils/hedgingCalc'
import TreeScene from '@/components/tree3d/TreeScene'
import DetailTable from '@/components/panels/DetailTable'
import AnomalyPanel from '@/components/panels/AnomalyPanel'
import SummaryCards from '@/components/panels/SummaryCards'

export default function DetailPage() {
  const subsidiaries = useExposureStore((s) => s.subsidiaries)
  const currencies = useExposureStore((s) => s.currencies)
  const exposures = useExposureStore((s) => s.exposures)
  const hedgeContracts = useExposureStore((s) => s.hedgeContracts)
  const selectedCurrencies = useExposureStore((s) => s.selectedCurrencies)
  const selectedSubsidiaryCodes = useExposureStore((s) => s.selectedSubsidiaryCodes)
  const selectedDirections = useExposureStore((s) => s.selectedDirections)
  const dataLoaded = useExposureStore((s) => s.dataLoaded)
  const [tab, setTab] = useState(0)

  const treeData = useMemo(
    () => buildTreeData(subsidiaries, currencies, exposures, hedgeContracts, selectedCurrencies, selectedSubsidiaryCodes, selectedDirections),
    [subsidiaries, currencies, exposures, hedgeContracts, selectedCurrencies, selectedSubsidiaryCodes, selectedDirections]
  )

  const summary = useMemo(() => calcSummary(exposures, hedgeContracts), [exposures, hedgeContracts])

  if (!dataLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-txt-muted">
          <p className="text-sm">请先在总览页导入数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <div className="w-[45%] relative">
        <TreeScene treeData={treeData} />
      </div>
      <div className="flex-1 border-l border-border bg-panel flex flex-col">
        <div className="p-4 border-b border-border">
          <SummaryCards summary={summary} />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b border-border">
            <button
              className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${tab === 0 ? 'text-accent-green' : 'text-txt-secondary hover:text-txt-primary'}`}
              onClick={() => setTab(0)}
            >
              敞口明细
              {tab === 0 && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent-green rounded-full" />}
            </button>
            <button
              className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${tab === 1 ? 'text-accent-green' : 'text-txt-secondary hover:text-txt-primary'}`}
              onClick={() => setTab(1)}
            >
              异常检测
              {tab === 1 && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent-green rounded-full" />}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {tab === 0 ? <DetailTable /> : <AnomalyPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
