import { useMemo } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { buildTreeData, calcSummary } from '@/utils/hedgingCalc'
import TreeScene from '@/components/tree3d/TreeScene'
import SummaryCards from '@/components/panels/SummaryCards'
import CurrencyFilter from '@/components/panels/CurrencyFilter'
import ExportBar from '@/components/review/ExportBar'

export default function OverviewPage() {
  const subsidiaries = useExposureStore((s) => s.subsidiaries)
  const currencies = useExposureStore((s) => s.currencies)
  const exposures = useExposureStore((s) => s.exposures)
  const hedgeContracts = useExposureStore((s) => s.hedgeContracts)
  const selectedCurrencies = useExposureStore((s) => s.selectedCurrencies)
  const selectedSubsidiaries = useExposureStore((s) => s.selectedSubsidiaries)
  const selectedDirections = useExposureStore((s) => s.selectedDirections)
  const dataLoaded = useExposureStore((s) => s.dataLoaded)
  const selectedNodeId = useExposureStore((s) => s.selectedNodeId)

  const treeData = useMemo(
    () => buildTreeData(subsidiaries, currencies, exposures, hedgeContracts, selectedCurrencies, selectedSubsidiaries, selectedDirections),
    [subsidiaries, currencies, exposures, hedgeContracts, selectedCurrencies, selectedSubsidiaries, selectedDirections]
  )

  const summary = useMemo(() => calcSummary(exposures, hedgeContracts), [exposures, hedgeContracts])

  const selectedInfo = useMemo(() => {
    if (!selectedNodeId) return null
    if (selectedNodeId.startsWith('cur-')) {
      const parts = selectedNodeId.replace('cur-', '').split('-')
      const subId = parts[0]
      const curCode = parts.slice(1).join('-')
      const sub = subsidiaries.find((s) => s.id === subId)
      return { type: 'currency' as const, label: `${sub?.name || subId} - ${curCode}` }
    }
    if (selectedNodeId.startsWith('sub-')) {
      const subId = selectedNodeId.replace('sub-', '')
      const sub = subsidiaries.find((s) => s.id === subId)
      return { type: 'subsidiary' as const, label: sub?.name || subId }
    }
    return { type: 'root' as const, label: '集团总部' }
  }, [selectedNodeId, subsidiaries])

  if (!dataLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-blue/20 border border-border flex items-center justify-center">
            <span className="text-3xl font-mono font-bold text-accent-green">FX</span>
          </div>
          <h2 className="font-display text-xl font-bold text-txt-primary mb-2">外汇敞口币种树</h2>
          <p className="text-sm text-txt-secondary mb-6">请导入数据或加载演示数据以开始</p>
          <div className="flex items-center justify-center gap-4 text-xs text-txt-muted">
            <span>支持 CSV / Excel 导入</span>
            <span>·</span>
            <span>保留原始口径和手工备注</span>
            <span>·</span>
            <span>3D可视化自然对冲</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 relative">
        <TreeScene treeData={treeData} />
        {selectedInfo && (
          <div className="absolute top-4 left-4 card bg-panel/90 backdrop-blur-sm animate-fade-in">
            <div className="text-xs text-txt-muted">选中节点</div>
            <div className="text-sm font-medium text-txt-primary mt-0.5">
              {selectedInfo.type === 'currency' && <span className="text-accent-green mr-1">●</span>}
              {selectedInfo.type === 'subsidiary' && <span className="text-accent-blue mr-1">●</span>}
              {selectedInfo.type === 'root' && <span className="text-accent-gold mr-1">●</span>}
              {selectedInfo.label}
            </div>
          </div>
        )}
      </div>
      <div className="w-[380px] border-l border-border bg-panel flex flex-col">
        <div className="p-4 border-b border-border">
          <SummaryCards summary={summary} />
        </div>
        <div className="p-4 border-b border-border">
          <CurrencyFilter />
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <div className="text-xs text-txt-secondary mb-2 font-medium">敞口明细预览</div>
          {exposures.slice(0, 8).map((exp) => {
            const sub = subsidiaries.find((s) => s.id === exp.subsidiaryId)
            return (
              <div key={exp.id} className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                <span className="text-txt-secondary">{sub?.name || exp.subsidiaryId}</span>
                <span className="font-mono">{exp.currencyCode}</span>
                <span className={`font-mono ${exp.direction === 'LONG' ? 'text-accent-green' : 'text-accent-red'}`}>
                  {exp.direction === 'LONG' ? '+' : '-'}{(exp.amount / 1e6).toFixed(1)}M
                </span>
              </div>
            )
          })}
          {exposures.length > 8 && (
            <div className="text-xs text-txt-muted mt-2 text-center">还有 {exposures.length - 8} 条，请至明细页查看</div>
          )}
        </div>
        <div className="p-3 border-t border-border">
          <ExportBar />
        </div>
      </div>
    </div>
  )
}
