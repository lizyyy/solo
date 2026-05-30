import { create } from 'zustand'
import localforage from 'localforage'
import type { Plan, FrequencyBand, Note } from '@/types'
import useDataStore from './dataStore'

const STORAGE_KEY = 'soundfield-plans'

interface PlanState {
  plans: Plan[]
  currentPlanId: string | null
  comparePlanIds: [string, string] | null
  reportPlanId: string | null
}

interface PlanActions {
  savePlan: (name: string, band: FrequencyBand) => void
  loadPlan: (id: string) => void
  deletePlan: (id: string) => void
  addNote: (planId: string, targetType: 'seat' | 'speaker', targetId: string, content: string) => void
  deleteNote: (planId: string, noteId: string) => void
  setComparePlanIds: (ids: [string, string] | null) => void
  setReportPlanId: (id: string | null) => void
}

const usePlanStore = create<PlanState & PlanActions>()((set, get) => ({
  plans: [],
  currentPlanId: null,
  comparePlanIds: null,
  reportPlanId: null,

  savePlan: (name, band) => {
    const { measurements } = useDataStore.getState()
    const snapshot = measurements
      .filter((m) => m.frequencyBand === band)
      .map((m) => ({ seatId: m.seatId, splDB: m.splDB }))

    const newPlan: Plan = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      frequencyBand: band,
      notes: [],
      snapshot,
    }
    set((state) => ({
      plans: [...state.plans, newPlan],
      currentPlanId: newPlan.id,
    }))
  },

  loadPlan: (id) => {
    const plan = get().plans.find((p) => p.id === id)
    if (!plan) return
    set({ currentPlanId: id })
    const { measurements } = useDataStore.getState()
    const updatedMeasurements = measurements.map((m) => {
      const snap = plan.snapshot.find((s) => s.seatId === m.seatId)
      if (snap && m.frequencyBand === plan.frequencyBand) {
        return { ...m, splDB: snap.splDB }
      }
      return m
    })
    useDataStore.setState({ measurements: updatedMeasurements })
  },

  deletePlan: (id) => {
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
      currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
      comparePlanIds: state.comparePlanIds?.includes(id) ? null : state.comparePlanIds,
      reportPlanId: state.reportPlanId === id ? null : state.reportPlanId,
    }))
  },

  addNote: (planId, targetType, targetId, content) => {
    const note: Note = {
      id: crypto.randomUUID(),
      planId,
      targetType,
      targetId,
      content,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              notes: [...p.notes, note],
            }
          : p,
      ),
    }))
  },

  deleteNote: (planId, noteId) => {
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, notes: p.notes.filter((n) => n.id !== noteId) }
          : p,
      ),
    }))
  },

  setComparePlanIds: (ids) => set({ comparePlanIds: ids }),
  setReportPlanId: (id) => set({ reportPlanId: id }),
}))

localforage.getItem<Pick<PlanState, 'plans' | 'currentPlanId' | 'comparePlanIds' | 'reportPlanId'>>(STORAGE_KEY).then(
  (data) => {
    if (data) {
      usePlanStore.setState({
        plans: data.plans ?? [],
        currentPlanId: data.currentPlanId ?? null,
        comparePlanIds: data.comparePlanIds ?? null,
        reportPlanId: data.reportPlanId ?? null,
      })
    }
  },
)

usePlanStore.subscribe((state) => {
  localforage.setItem(STORAGE_KEY, {
    plans: state.plans,
    currentPlanId: state.currentPlanId,
    comparePlanIds: state.comparePlanIds,
    reportPlanId: state.reportPlanId,
  })
})

export default usePlanStore
