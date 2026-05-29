import { create } from 'zustand'
import type { RiskItem, LineageNode, LineageEdge, FieldAlias, RiskSeverity } from '@/types'
import { analyzeRisks, getRiskStats } from '@/engine/riskAnalyzer'

interface RiskState {
  risks: RiskItem[]
  filterSeverity: RiskSeverity | 'all'
  filterStatus: RiskItem['status'] | 'all'
  stats: ReturnType<typeof getRiskStats>
  loadRisks: (nodes: LineageNode[], edges: LineageEdge[], aliases: FieldAlias[]) => void
  setFilterSeverity: (s: RiskSeverity | 'all') => void
  setFilterStatus: (s: RiskItem['status'] | 'all') => void
  updateRiskStatus: (id: string, status: RiskItem['status'], resolvedBy: string) => void
  getFilteredRisks: () => RiskItem[]
}

export const useRiskStore = create<RiskState>((set, get) => ({
  risks: [],
  filterSeverity: 'all',
  filterStatus: 'all',
  stats: { total: 0, pending: 0, confirmed: 0, ignored: 0, high: 0, medium: 0, low: 0 },
  loadRisks: (nodes, edges, aliases) => {
    const existingRisks = get().risks
    const risks = analyzeRisks(nodes, edges, aliases, existingRisks)
    const stats = getRiskStats(risks)
    set({ risks, stats })
  },
  setFilterSeverity: (s) => set({ filterSeverity: s }),
  setFilterStatus: (s) => set({ filterStatus: s }),
  updateRiskStatus: (id, status, resolvedBy) => {
    set((s) => ({
      risks: s.risks.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              resolvedBy,
              resolvedAt: status !== 'pending' ? new Date().toISOString() : '',
            }
          : r
      ),
    }))
    const stats = getRiskStats(get().risks)
    set({ stats })
  },
  getFilteredRisks: () => {
    const { risks, filterSeverity, filterStatus } = get()
    return risks.filter((r) => {
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      return true
    })
  },
}))
