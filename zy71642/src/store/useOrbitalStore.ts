import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MOLECULES } from '@/data/molecules'

export type AnomalyType = 'energy_order_error' | 'node_occlusion' | 'color_misleading' | 'custom'

export interface Note {
  id: string
  orbitalId: string
  content: string
  timestamp: number
  anomalyTag?: AnomalyType
}

export interface AnomalyItem {
  id: string
  type: AnomalyType
  description: string
  orbitalId: string
  status: 'pending' | 'resolved' | 'dismissed'
  timestamp: number
}

export interface Screenshot {
  id: string
  dataUrl: string
  timestamp: number
  orbitalId: string
  filterState: string
  anomalyNote: string
}

export interface HistorySnapshot {
  id: string
  timestamp: number
  action: string
  moleculeId: string
  orbitalId: string
  showNodePlanes: boolean
  nodePlaneOpacity: number
  sectionPosition: number
  showSection: boolean
  isosurfaceThreshold: number
}

interface OrbitalStore {
  currentMoleculeId: string
  currentOrbitalId: string
  showNodePlanes: boolean
  nodePlaneOpacity: number
  sectionPosition: number
  showSection: boolean
  isosurfaceThreshold: number
  notes: Note[]
  anomalyQueue: AnomalyItem[]
  screenshots: Screenshot[]
  history: HistorySnapshot[]
  rightPanelTab: 'control' | 'notes' | 'anomaly' | 'history' | 'report'
  sectionAxis: 'x' | 'y' | 'z'
  compareSnapshotId: string | null
  screenshotModalOpen: boolean
  currentScreenshotDataUrl: string

  setCurrentMolecule: (id: string) => void
  setCurrentOrbital: (id: string) => void
  setShowNodePlanes: (show: boolean) => void
  setNodePlaneOpacity: (opacity: number) => void
  setSectionPosition: (pos: number) => void
  setShowSection: (show: boolean) => void
  setIsosurfaceThreshold: (threshold: number) => void
  setRightPanelTab: (tab: OrbitalStore['rightPanelTab']) => void
  setSectionAxis: (axis: 'x' | 'y' | 'z') => void
  setCompareSnapshotId: (id: string | null) => void
  setScreenshotModalOpen: (open: boolean) => void
  setCurrentScreenshotDataUrl: (url: string) => void

  addNote: (note: Omit<Note, 'id' | 'timestamp'>) => void
  removeNote: (id: string) => void

  addAnomaly: (item: Omit<AnomalyItem, 'id' | 'timestamp'>) => void
  updateAnomalyStatus: (id: string, status: AnomalyItem['status']) => void
  removeAnomaly: (id: string) => void

  addScreenshot: (screenshot: Omit<Screenshot, 'id' | 'timestamp'>) => void

  pushHistory: (action: string) => void
  restoreSnapshot: (id: string) => void
  clearHistory: () => void
}

const firstMolecule = MOLECULES[0]
const firstOrbital = firstMolecule.energyOrder[0]

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const useOrbitalStore = create<OrbitalStore>()(
  persist(
    (set, get) => ({
      currentMoleculeId: firstMolecule.id,
      currentOrbitalId: firstOrbital,
      showNodePlanes: true,
      nodePlaneOpacity: 0.3,
      sectionPosition: 0,
      showSection: false,
      isosurfaceThreshold: 0.35,
      notes: [],
      anomalyQueue: [],
      screenshots: [],
      history: [],
      rightPanelTab: 'control',
      sectionAxis: 'x',
      compareSnapshotId: null,
      screenshotModalOpen: false,
      currentScreenshotDataUrl: '',

      setCurrentMolecule: (id) => {
        const molecule = MOLECULES.find((m) => m.id === id)
        const firstOrb = molecule?.energyOrder[0] || ''
        set({ currentMoleculeId: id, currentOrbitalId: firstOrb })
        get().pushHistory('切换分子')
      },

      setCurrentOrbital: (id) => {
        set({ currentOrbitalId: id })
        get().pushHistory('切换轨道')
      },

      setShowNodePlanes: (show) => {
        set({ showNodePlanes: show })
        get().pushHistory('切换节点面')
      },

      setNodePlaneOpacity: (opacity) => set({ nodePlaneOpacity: opacity }),

      setSectionPosition: (pos) => set({ sectionPosition: pos }),

      setShowSection: (show) => {
        set({ showSection: show })
        get().pushHistory('切换截面')
      },

      setIsosurfaceThreshold: (threshold) => set({ isosurfaceThreshold: threshold }),

      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

      setSectionAxis: (axis) => set({ sectionAxis: axis }),

      setCompareSnapshotId: (id) => set({ compareSnapshotId: id }),

      setScreenshotModalOpen: (open) => set({ screenshotModalOpen: open }),

      setCurrentScreenshotDataUrl: (url) => set({ currentScreenshotDataUrl: url }),

      addNote: (note) => {
        const newNote: Note = { ...note, id: genId(), timestamp: Date.now() }
        set((s) => ({ notes: [newNote, ...s.notes] }))
        get().pushHistory('添加备注')
      },

      removeNote: (id) => {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
      },

      addAnomaly: (item) => {
        const newItem: AnomalyItem = { ...item, id: genId(), timestamp: Date.now() }
        set((s) => ({ anomalyQueue: [newItem, ...s.anomalyQueue] }))
        get().pushHistory('标记异常')
      },

      updateAnomalyStatus: (id, status) => {
        set((s) => ({
          anomalyQueue: s.anomalyQueue.map((a) => (a.id === id ? { ...a, status } : a)),
        }))
      },

      removeAnomaly: (id) => {
        set((s) => ({ anomalyQueue: s.anomalyQueue.filter((a) => a.id !== id) }))
      },

      addScreenshot: (screenshot) => {
        const newScreenshot: Screenshot = { ...screenshot, id: genId(), timestamp: Date.now() }
        set((s) => ({ screenshots: [newScreenshot, ...s.screenshots] }))
        get().pushHistory('截图')
      },

      pushHistory: (action) => {
        const s = get()
        const snapshot: HistorySnapshot = {
          id: genId(),
          timestamp: Date.now(),
          action,
          moleculeId: s.currentMoleculeId,
          orbitalId: s.currentOrbitalId,
          showNodePlanes: s.showNodePlanes,
          nodePlaneOpacity: s.nodePlaneOpacity,
          sectionPosition: s.sectionPosition,
          showSection: s.showSection,
          isosurfaceThreshold: s.isosurfaceThreshold,
        }
        set((state) => ({
          history: [snapshot, ...state.history].slice(0, 100),
        }))
      },

      restoreSnapshot: (id) => {
        const snapshot = get().history.find((h) => h.id === id)
        if (!snapshot) return
        set({
          currentMoleculeId: snapshot.moleculeId,
          currentOrbitalId: snapshot.orbitalId,
          showNodePlanes: snapshot.showNodePlanes,
          nodePlaneOpacity: snapshot.nodePlaneOpacity,
          sectionPosition: snapshot.sectionPosition,
          showSection: snapshot.showSection,
          isosurfaceThreshold: snapshot.isosurfaceThreshold,
        })
        get().pushHistory('恢复快照')
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'molecular-orbital-classroom',
      partialize: (state) => ({
        currentMoleculeId: state.currentMoleculeId,
        currentOrbitalId: state.currentOrbitalId,
        showNodePlanes: state.showNodePlanes,
        nodePlaneOpacity: state.nodePlaneOpacity,
        sectionPosition: state.sectionPosition,
        showSection: state.showSection,
        isosurfaceThreshold: state.isosurfaceThreshold,
        notes: state.notes,
        anomalyQueue: state.anomalyQueue,
        screenshots: state.screenshots,
        history: state.history,
      }),
    }
  )
)
