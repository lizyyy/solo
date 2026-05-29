import { create } from 'zustand'
import type { LineageNode, LineageEdge, FieldAlias, ChangeOrder } from '@/types'
import {
  fields,
  fieldAliases,
  etlTasks,
  reports,
  apiMappings,
  lineageNodes,
  lineageEdges,
  changeOrders as demoChangeOrders,
} from '@/data/demoData'

interface LineageState {
  nodes: LineageNode[]
  edges: LineageEdge[]
  aliases: FieldAlias[]
  changeOrders: typeof demoChangeOrders
  selectedNodeId: string | null
  searchQuery: string
  highlightedNodeIds: Set<string>
  fields: typeof fields
  etlTasks: typeof etlTasks
  reports: typeof reports
  apiMappings: typeof apiMappings
  setSelectedNode: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setHighlightedNodes: (ids: Set<string>) => void
  addEdge: (edge: LineageEdge) => void
  removeEdge: (id: string) => void
  addAlias: (alias: FieldAlias) => void
  removeAlias: (id: string) => void
  updateAlias: (id: string, updates: Partial<FieldAlias>) => void
  updateNode: (id: string, updates: Partial<LineageNode>) => void
}

export const useLineageStore = create<LineageState>((set) => ({
  nodes: lineageNodes,
  edges: lineageEdges,
  aliases: fieldAliases,
  changeOrders: demoChangeOrders,
  selectedNodeId: null,
  searchQuery: '',
  highlightedNodeIds: new Set(),
  fields,
  etlTasks,
  reports,
  apiMappings,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),
  addAlias: (alias) => set((s) => ({ aliases: [...s.aliases, alias] })),
  removeAlias: (id) => set((s) => ({ aliases: s.aliases.filter((a) => a.id !== id) })),
  updateAlias: (id, updates) =>
    set((s) => ({
      aliases: s.aliases.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  updateNode: (id, updates) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),
}))
