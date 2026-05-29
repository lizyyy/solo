import { create } from 'zustand'
import type { ImpactResult } from '@/types'
import { scanImpact } from '@/engine/impactScanner'
import type { LineageNode, LineageEdge } from '@/types'

interface ScanState {
  query: string
  results: ImpactResult[]
  isScanning: boolean
  hasScanned: boolean
  setQuery: (q: string) => void
  executeScan: (nodes: LineageNode[], edges: LineageEdge[]) => void
  clearResults: () => void
}

export const useScanStore = create<ScanState>((set) => ({
  query: '',
  results: [],
  isScanning: false,
  hasScanned: false,
  setQuery: (q) => set({ query: q }),
  executeScan: (nodes, edges) => {
    set({ isScanning: true })
    const results = scanImpact(
      useScanStore.getState().query,
      nodes,
      edges
    )
    set({ results, isScanning: false, hasScanned: true })
  },
  clearResults: () => set({ results: [], hasScanned: false, query: '' }),
}))
