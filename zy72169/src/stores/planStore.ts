import { create } from 'zustand'
import type { PlanVersion, PlanLocation } from '@/types'
import { getDB, generateId, nowISO } from '@/services/db'

interface PlanState {
  planVersions: PlanVersion[]
  planLocations: PlanLocation[]
  loadAll: () => Promise<void>
  addPlanVersion: (version: Omit<PlanVersion, 'id' | 'createdAt'>) => Promise<PlanVersion>
  addPlanLocation: (planLocation: Omit<PlanLocation, 'id'>) => Promise<void>
  getLocationsByPlanId: (planId: string) => PlanLocation[]
  getPlansByLocationId: (locationId: string) => PlanVersion[]
}

export const usePlanStore = create<PlanState>((set, get) => ({
  planVersions: [],
  planLocations: [],

  loadAll: async () => {
    const db = await getDB()
    const planVersions = await db.getAll('planVersions')
    const planLocations = await db.getAll('planLocations')
    set({ planVersions, planLocations })
  },

  addPlanVersion: async (version) => {
    const db = await getDB()
    const record: PlanVersion = { ...version, id: generateId(), createdAt: nowISO() }
    await db.put('planVersions', record)
    set((state) => ({ planVersions: [...state.planVersions, record] }))
    return record
  },

  addPlanLocation: async (planLocation) => {
    const db = await getDB()
    const record: PlanLocation = { ...planLocation, id: generateId() }
    await db.put('planLocations', record)
    set((state) => ({ planLocations: [...state.planLocations, record] }))
  },

  getLocationsByPlanId: (planId) => {
    return get().planLocations.filter((pl) => pl.planId === planId)
  },

  getPlansByLocationId: (locationId) => {
    const planIds = get()
      .planLocations.filter((pl) => pl.locationId === locationId)
      .map((pl) => pl.planId)
    return get().planVersions.filter((pv) => planIds.includes(pv.id))
  },
}))
