import { create } from 'zustand'
import type {
  RobotTrajectory,
  Shelf,
  TaskOrder,
  AnomalyRecord,
  HeatmapConfig,
  BatteryConfig,
  FilterState,
  AuditEntry,
  AnomalyTabType,
} from '../utils/types'
import { detectAllAnomalies } from '../utils/anomalyDetector'
import { trajectories as rawTrajectories } from '../data/trajectories'
import { shelves as rawShelves } from '../data/shelves'
import { tasks as rawTasks } from '../data/tasks'

interface WarehouseStore {
  trajectories: RobotTrajectory[]
  shelves: Shelf[]
  tasks: TaskOrder[]
  anomalies: AnomalyRecord[]

  heatmapConfig: HeatmapConfig
  batteryConfig: BatteryConfig
  filterState: FilterState

  anomalyTab: AnomalyTabType
  selectedTrajectoryId: string | null
  selectedAnomalyId: string | null
  panelOpen: boolean
  replayProgress: number
  showHeatmap: boolean
  showBattery: boolean
  showAnomalyMarkers: boolean

  setHeatmapConfig: (config: Partial<HeatmapConfig>) => void
  setBatteryConfig: (config: Partial<BatteryConfig>) => void
  setFilterState: (filter: Partial<FilterState>) => void
  setAnomalyTab: (tab: AnomalyTabType) => void
  setSelectedTrajectoryId: (id: string | null) => void
  setSelectedAnomalyId: (id: string | null) => void
  togglePanel: () => void
  setReplayProgress: (p: number) => void
  setShowHeatmap: (v: boolean) => void
  setShowBattery: (v: boolean) => void
  setShowAnomalyMarkers: (v: boolean) => void

  confirmAnomaly: (id: string, operator: string) => void
  rejectAnomaly: (id: string, operator: string) => void
  addNoteToAnomaly: (id: string, operator: string, note: string) => void

  filteredTrajectories: () => RobotTrajectory[]
  filteredTasks: () => TaskOrder[]
  filteredAnomalies: () => AnomalyRecord[]
}

const initialAnomalies = detectAllAnomalies(rawTrajectories, rawShelves, rawTasks, 20)

export const useStore = create<WarehouseStore>((set, get) => ({
  trajectories: rawTrajectories,
  shelves: rawShelves,
  tasks: rawTasks,
  anomalies: initialAnomalies,

  heatmapConfig: { gridSize: 4, threshold: 0.1, opacity: 0.6 },
  batteryConfig: { lowThreshold: 20, dropThreshold: 20 },
  filterState: {
    statusFilter: ['normal', 'supplementary', 'withdrawn', 'duplicate'],
    robotIds: [],
    timeRange: [0, Infinity],
  },

  anomalyTab: 'all',
  selectedTrajectoryId: null,
  selectedAnomalyId: null,
  panelOpen: true,
  replayProgress: 1,
  showHeatmap: true,
  showBattery: true,
  showAnomalyMarkers: true,

  setHeatmapConfig: (config) =>
    set((s) => ({ heatmapConfig: { ...s.heatmapConfig, ...config } })),
  setBatteryConfig: (config) =>
    set((s) => ({ batteryConfig: { ...s.batteryConfig, ...config } })),
  setFilterState: (filter) =>
    set((s) => ({ filterState: { ...s.filterState, ...filter } })),
  setAnomalyTab: (tab) => set({ anomalyTab: tab }),
  setSelectedTrajectoryId: (id) => set({ selectedTrajectoryId: id }),
  setSelectedAnomalyId: (id) => set({ selectedAnomalyId: id }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setReplayProgress: (p) => set({ replayProgress: p }),
  setShowHeatmap: (v) => set({ showHeatmap: v }),
  setShowBattery: (v) => set({ showBattery: v }),
  setShowAnomalyMarkers: (v) => set({ showAnomalyMarkers: v }),

  confirmAnomaly: (id, operator) =>
    set((s) => ({
      anomalies: s.anomalies.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'confirmed' as const,
              auditLog: [
                ...a.auditLog,
                {
                  timestamp: Date.now(),
                  operator,
                  action: 'confirm' as const,
                  detail: '确认异常',
                },
              ],
            }
          : a,
      ),
    })),

  rejectAnomaly: (id, operator) =>
    set((s) => ({
      anomalies: s.anomalies.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'rejected' as const,
              auditLog: [
                ...a.auditLog,
                {
                  timestamp: Date.now(),
                  operator,
                  action: 'reject' as const,
                  detail: '驳回异常',
                },
              ],
            }
          : a,
      ),
    })),

  addNoteToAnomaly: (id, operator, note) =>
    set((s) => ({
      anomalies: s.anomalies.map((a) =>
        a.id === id
          ? {
              ...a,
              auditLog: [
                ...a.auditLog,
                {
                  timestamp: Date.now(),
                  operator,
                  action: 'note' as const,
                  detail: note,
                },
              ],
            }
          : a,
      ),
    })),

  filteredTrajectories: () => {
    const { trajectories, filterState } = get()
    return trajectories.filter((t) => {
      if (!filterState.statusFilter.includes(t.status)) return false
      if (filterState.robotIds.length > 0 && !filterState.robotIds.includes(t.robotId))
        return false
      return true
    })
  },

  filteredTasks: () => {
    const { tasks, filterState } = get()
    return tasks.filter((t) => {
      if (!filterState.statusFilter.includes(t.status)) return false
      if (filterState.robotIds.length > 0 && !filterState.robotIds.includes(t.robotId))
        return false
      return true
    })
  },

  filteredAnomalies: () => {
    const { anomalies, anomalyTab } = get()
    if (anomalyTab === 'all') return anomalies
    return anomalies.filter((a) => a.type === anomalyTab)
  },
}))
