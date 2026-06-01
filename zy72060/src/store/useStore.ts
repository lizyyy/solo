import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  Plan,
  InspectionPoint,
  TraceRecord,
  ConflictEvidence,
  InspectionPhoto,
  ScreenshotRecord,
  CameraState,
  ViewPreset,
  PointStatus,
} from '@/types'
import {
  SAMPLE_PLAN,
  SAMPLE_PLAN_V1,
  SAMPLE_POINTS,
  SAMPLE_TRACES,
  SAMPLE_CONFLICTS,
  SAMPLE_PHOTOS,
} from '@/data/sampleData'

interface AppState {
  plans: Plan[]
  currentPlanId: string | null
  points: InspectionPoint[]
  traces: TraceRecord[]
  conflicts: ConflictEvidence[]
  photos: InspectionPhoto[]
  screenshots: ScreenshotRecord[]
  selectedPointId: string | null
  cameraState: CameraState
  viewPreset: ViewPreset
  filterStatus: PointStatus | 'all'
  sidebarOpen: boolean
  conflictPanelOpen: boolean
  conflictPointId: string | null

  setCurrentPlan: (planId: string) => void
  addPlan: (plan: Plan) => void
  updatePlan: (planId: string, updates: Partial<Plan>) => void
  deletePlan: (planId: string) => void
  setPoints: (points: InspectionPoint[]) => void
  addPoints: (points: InspectionPoint[]) => void
  updatePoint: (pointId: string, updates: Partial<InspectionPoint>) => void
  setTraces: (traces: TraceRecord[]) => void
  addTrace: (trace: TraceRecord) => void
  updateTrace: (traceId: string, updates: Partial<TraceRecord>) => void
  setConflicts: (conflicts: ConflictEvidence[]) => void
  addConflicts: (conflicts: ConflictEvidence[]) => void
  setPhotos: (photos: InspectionPhoto[]) => void
  addPhoto: (photo: InspectionPhoto) => void
  addScreenshot: (screenshot: ScreenshotRecord) => void
  selectPoint: (pointId: string | null) => void
  setCameraState: (state: CameraState) => void
  setViewPreset: (preset: ViewPreset) => void
  setFilterStatus: (status: PointStatus | 'all') => void
  toggleSidebar: () => void
  openConflictPanel: (pointId: string) => void
  closeConflictPanel: () => void
  loadSampleData: () => void
  loadPlanData: (planId: string) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      plans: [SAMPLE_PLAN_V1, SAMPLE_PLAN],
      currentPlanId: SAMPLE_PLAN.id,
      points: SAMPLE_POINTS,
      traces: SAMPLE_TRACES,
      conflicts: SAMPLE_CONFLICTS,
      photos: SAMPLE_PHOTOS,
      screenshots: [],
      selectedPointId: null,
      cameraState: SAMPLE_PLAN.cameraState,
      viewPreset: 'free',
      filterStatus: 'all',
      sidebarOpen: false,
      conflictPanelOpen: false,
      conflictPointId: null,

      setCurrentPlan: (planId) => {
        const plan = get().plans.find((p) => p.id === planId)
        if (plan) {
          set({
            currentPlanId: planId,
            cameraState: plan.cameraState,
            viewPreset: (plan.viewPreset as ViewPreset) || 'free',
          })
          const planPoints = SAMPLE_POINTS.filter((p) => p.planId === planId)
          if (planPoints.length > 0) {
            set({ points: planPoints })
          }
        }
      },

      addPlan: (plan) =>
        set((s) => ({ plans: [...s.plans, plan] })),

      updatePlan: (planId, updates) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id === planId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        })),

      deletePlan: (planId) =>
        set((s) => ({ plans: s.plans.filter((p) => p.id !== planId) })),

      setPoints: (points) => set({ points }),

      addPoints: (points) =>
        set((s) => ({ points: [...s.points, ...points] })),

      updatePoint: (pointId, updates) =>
        set((s) => ({
          points: s.points.map((p) =>
            p.id === pointId ? { ...p, ...updates } : p
          ),
        })),

      setTraces: (traces) => set({ traces }),

      addTrace: (trace) =>
        set((s) => ({ traces: [...s.traces, trace] })),

      updateTrace: (traceId, updates) =>
        set((s) => ({
          traces: s.traces.map((t) =>
            t.id === traceId ? { ...t, ...updates } : t
          ),
        })),

      setConflicts: (conflicts) => set({ conflicts }),

      addConflicts: (conflicts) =>
        set((s) => ({ conflicts: [...s.conflicts, ...conflicts] })),

      setPhotos: (photos) => set({ photos }),

      addPhoto: (photo) =>
        set((s) => ({ photos: [...s.photos, photo] })),

      addScreenshot: (screenshot) =>
        set((s) => ({ screenshots: [...s.screenshots, screenshot] })),

      selectPoint: (pointId) =>
        set({ selectedPointId: pointId, sidebarOpen: pointId !== null }),

      setCameraState: (cameraState) => {
        set({ cameraState, viewPreset: 'free' })
        const { currentPlanId, plans } = get()
        if (currentPlanId) {
          set((s) => ({
            plans: s.plans.map((p) =>
              p.id === currentPlanId ? { ...p, cameraState, updatedAt: new Date().toISOString() } : p
            ),
          }))
        }
      },

      setViewPreset: (preset) => set({ viewPreset: preset }),

      setFilterStatus: (status) => set({ filterStatus: status }),

      toggleSidebar: () =>
        set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      openConflictPanel: (pointId) =>
        set({ conflictPanelOpen: true, conflictPointId: pointId }),

      closeConflictPanel: () =>
        set({ conflictPanelOpen: false, conflictPointId: null }),

      loadSampleData: () =>
        set({
          plans: [SAMPLE_PLAN_V1, SAMPLE_PLAN],
          currentPlanId: SAMPLE_PLAN.id,
          points: SAMPLE_POINTS,
          traces: SAMPLE_TRACES,
          conflicts: SAMPLE_CONFLICTS,
          photos: SAMPLE_PHOTOS,
          cameraState: SAMPLE_PLAN.cameraState,
          viewPreset: 'free',
          selectedPointId: null,
          filterStatus: 'all',
        }),

      loadPlanData: (planId) => {
        get().setCurrentPlan(planId)
      },
    }),
    {
      name: 'crane-cube-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        plans: state.plans,
        currentPlanId: state.currentPlanId,
        points: state.points,
        traces: state.traces,
        conflicts: state.conflicts,
        photos: state.photos,
        screenshots: state.screenshots,
        cameraState: state.cameraState,
        viewPreset: state.viewPreset,
        filterStatus: state.filterStatus,
        selectedPointId: state.selectedPointId,
      }),
    }
  )
)
