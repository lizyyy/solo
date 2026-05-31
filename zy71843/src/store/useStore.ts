import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Project,
  LightPosition,
  ChangeRecord,
  AnomalyNote,
  ChangeType,
} from '@/types'

interface StoreState {
  projects: Project[]
  positions: LightPosition[]
  changeRecords: ChangeRecord[]
  anomalyNotes: AnomalyNote[]

  addProject: (name: string) => void
  addPosition: (position: Omit<LightPosition, 'id' | 'lastModified'>) => void
  updatePosition: (
    id: string,
    updates: Partial<LightPosition>,
    changeType: ChangeType,
    reason: string,
  ) => void
  resolveAnomaly: (id: string) => void
  addAnomalyNote: (note: Omit<AnomalyNote, 'id'>) => void
  loadMockData: (data: {
    projects: Project[]
    positions: LightPosition[]
    changeRecords: ChangeRecord[]
    anomalyNotes: AnomalyNote[]
  }) => void
  getProjectPositions: (projectId: string) => LightPosition[]
  getPositionChanges: (positionId: string) => ChangeRecord[]
  getPositionAnomalies: (positionId: string) => AnomalyNote[]
  recalcProjectStats: (projectId: string) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      projects: [],
      positions: [],
      changeRecords: [],
      anomalyNotes: [],

      addProject: (name) => {
        const project: Project = {
          id: Date.now().toString(),
          name,
          totalPositions: 0,
          calibratedCount: 0,
          pendingCount: 0,
          anomalyCount: 0,
          lastModified: new Date().toISOString(),
        }
        set((state) => ({ projects: [...state.projects, project] }))
      },

      addPosition: (position) => {
        const newPosition: LightPosition = {
          ...position,
          id: Date.now().toString(),
          lastModified: new Date().toISOString(),
        }
        set((state) => ({
          positions: [...state.positions, newPosition],
        }))
        get().recalcProjectStats(position.projectId)
      },

      updatePosition: (id, updates, changeType, reason) => {
        const position = get().positions.find((p) => p.id === id)
        if (!position) return

        const previousValue = position.currentValue
        const nextValue = updates.currentValue ?? previousValue

        if (updates.currentValue !== undefined && previousValue !== nextValue) {
          const record: ChangeRecord = {
            id: Date.now().toString(),
            positionId: id,
            type: changeType,
            previousValue,
            newValue: nextValue,
            reason,
            timestamp: new Date().toISOString(),
          }
          set((state) => ({
            changeRecords: [...state.changeRecords, record],
          }))
        }

        set((state) => ({
          positions: state.positions.map((p) =>
            p.id === id
              ? { ...p, ...updates, lastModified: new Date().toISOString() }
              : p,
          ),
        }))

        get().recalcProjectStats(position.projectId)
      },

      resolveAnomaly: (id) => {
        set((state) => ({
          anomalyNotes: state.anomalyNotes.map((n) =>
            n.id === id ? { ...n, resolved: true } : n,
          ),
        }))
        const note = get().anomalyNotes.find((n) => n.id === id)
        if (note) {
          const position = get().positions.find((p) => p.id === note.positionId)
          if (position) {
            get().recalcProjectStats(position.projectId)
          }
        }
      },

      addAnomalyNote: (note) => {
        const newNote: AnomalyNote = {
          ...note,
          id: Date.now().toString(),
        }
        set((state) => ({
          anomalyNotes: [...state.anomalyNotes, newNote],
        }))
        const position = get().positions.find((p) => p.id === note.positionId)
        if (position) {
          get().recalcProjectStats(position.projectId)
        }
      },

      loadMockData: (data) => {
        set({
          projects: data.projects,
          positions: data.positions,
          changeRecords: data.changeRecords,
          anomalyNotes: data.anomalyNotes,
        })
      },

      getProjectPositions: (projectId) => {
        return get().positions.filter((p) => p.projectId === projectId)
      },

      getPositionChanges: (positionId) => {
        return get().changeRecords.filter((r) => r.positionId === positionId)
      },

      getPositionAnomalies: (positionId) => {
        return get().anomalyNotes.filter((n) => n.positionId === positionId)
      },

      recalcProjectStats: (projectId) => {
        const projectPositions = get().positions.filter(
          (p) => p.projectId === projectId,
        )
        const positionIds = projectPositions.map((p) => p.id)
        const anomalyPositionIds = new Set(
          get()
            .anomalyNotes.filter(
              (n) => positionIds.includes(n.positionId) && !n.resolved,
            )
            .map((n) => n.positionId),
        )

        const totalPositions = projectPositions.length
        const calibratedCount = projectPositions.filter(
          (p) => p.status === 'calibrated',
        ).length
        const pendingCount = projectPositions.filter(
          (p) => p.status === 'pending_material',
        ).length
        const anomalyCount = anomalyPositionIds.size

        set((state) => ({
          projects: state.projects.map((proj) =>
            proj.id === projectId
              ? {
                  ...proj,
                  totalPositions,
                  calibratedCount,
                  pendingCount,
                  anomalyCount,
                  lastModified: new Date().toISOString(),
                }
              : proj,
          ),
        }))
      },
    }),
    {
      name: 'light-calibration-store',
    },
  ),
)
