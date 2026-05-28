import { create } from "zustand"
import type {
  GraphNode,
  GraphEdge,
  BlacklistEntry,
  CapacityConfig,
  GroupResult,
  Conflict,
  HistoryRecord,
  AlgorithmConfig,
  SamplePackage,
} from "@/types"
import { DEFAULT_CAPACITY, DEFAULT_ALGORITHM_CONFIG } from "@/types"

interface AppState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  blacklist: BlacklistEntry[]
  projectLabels: Record<string, string[]>
  capacityConfig: CapacityConfig
  algorithmConfig: AlgorithmConfig
  groups: GroupResult[]
  conflicts: Conflict[]
  history: HistoryRecord[]
  isRunning: boolean
  dataLoaded: boolean

  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void
  setBlacklist: (blacklist: BlacklistEntry[]) => void
  setProjectLabels: (labels: Record<string, string[]>) => void
  setCapacityConfig: (config: CapacityConfig) => void
  setAlgorithmConfig: (config: AlgorithmConfig) => void
  setGroups: (groups: GroupResult[]) => void
  setConflicts: (conflicts: Conflict[]) => void
  setRunning: (running: boolean) => void
  loadSamplePackage: (pkg: SamplePackage) => void
  updateGroupStatus: (groupId: string, status: GroupResult["status"]) => void
  addHistory: (record: HistoryRecord) => void
  clearHistory: () => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  nodes: [],
  edges: [],
  blacklist: [],
  projectLabels: {},
  capacityConfig: DEFAULT_CAPACITY,
  algorithmConfig: DEFAULT_ALGORITHM_CONFIG,
  groups: [],
  conflicts: [],
  history: [],
  isRunning: false,
  dataLoaded: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setBlacklist: (blacklist) => set({ blacklist }),
  setProjectLabels: (projectLabels) => set({ projectLabels }),
  setCapacityConfig: (capacityConfig) => set({ capacityConfig }),
  setAlgorithmConfig: (algorithmConfig) => set({ algorithmConfig }),
  setGroups: (groups) => set({ groups }),
  setConflicts: (conflicts) => set({ conflicts }),
  setRunning: (isRunning) => set({ isRunning }),

  loadSamplePackage: (pkg) =>
    set({
      nodes: pkg.nodes,
      edges: pkg.edges,
      blacklist: pkg.blacklist,
      projectLabels: pkg.projectLabels,
      capacityConfig: pkg.capacityConfig,
      groups: pkg.previousGroups ?? [],
      conflicts: [],
      dataLoaded: true,
    }),

  updateGroupStatus: (groupId, status) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, status } : g
      ),
    })),

  addHistory: (record) =>
    set((state) => ({
      history: [record, ...state.history],
    })),

  clearHistory: () => set({ history: [] }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      blacklist: [],
      projectLabels: {},
      capacityConfig: DEFAULT_CAPACITY,
      algorithmConfig: DEFAULT_ALGORITHM_CONFIG,
      groups: [],
      conflicts: [],
      dataLoaded: false,
      isRunning: false,
    }),
}))
