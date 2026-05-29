import { useEffect } from 'react'
import { useRiskStore } from '@/store/useRiskStore'
import { useLineageStore } from '@/store/useLineageStore'
import RiskFilter from '@/components/risk/RiskFilter'
import RiskCard from '@/components/risk/RiskCard'

export default function RiskPage() {
  const nodes = useLineageStore((s) => s.nodes)
  const edges = useLineageStore((s) => s.edges)
  const aliases = useLineageStore((s) => s.aliases)
  const loadRisks = useRiskStore((s) => s.loadRisks)
  const risks = useRiskStore((s) => s.risks)
  const filterSeverity = useRiskStore((s) => s.filterSeverity)
  const filterStatus = useRiskStore((s) => s.filterStatus)

  useEffect(() => {
    loadRisks(nodes, edges, aliases)
  }, [nodes, edges, aliases, loadRisks])

  const filteredRisks = risks.filter((r) => {
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    return true
  })

  return (
    <div className="h-full overflow-auto p-6">
      <RiskFilter />
      {filteredRisks.length === 0 ? (
        <div className="text-center py-12 text-muted">暂无匹配的风险项</div>
      ) : (
        filteredRisks.map((risk) => <RiskCard key={risk.id} risk={risk} />)
      )}
    </div>
  )
}
