import { create } from 'zustand'
import * as api from '@/lib/api'
import type {
  SchemeSummary,
  SchemeDetail,
  Fixture,
  RiskItem,
  CreateSchemeInput,
  UpdateSchemeInput,
  CreatePointInput,
  UpdatePointInput,
  CreateFixtureInput,
  UpdateFixtureInput,
  CreateAssignmentInput,
} from '../../shared/types'

interface StoreState {
  currentSchemeId: string | null
  schemes: SchemeSummary[]
  schemeDetail: SchemeDetail | null
  fixtures: Fixture[]
  risks: RiskItem[]
  isLoading: boolean
  error: string | null
  activeTab: 'points' | 'fixtures' | 'force' | 'verification' | 'risks'

  fetchSchemes: () => Promise<void>
  selectScheme: (id: string) => Promise<void>
  createScheme: (input: CreateSchemeInput) => Promise<void>
  updateScheme: (id: string, input: UpdateSchemeInput) => Promise<void>
  deleteScheme: (id: string) => Promise<void>
  createPoint: (schemeId: string, input: CreatePointInput) => Promise<void>
  updatePoint: (schemeId: string, pointId: string, input: UpdatePointInput) => Promise<void>
  deletePoint: (schemeId: string, pointId: string) => Promise<void>
  createFixture: (input: CreateFixtureInput) => Promise<void>
  updateFixture: (id: string, input: UpdateFixtureInput) => Promise<void>
  deleteFixture: (id: string) => Promise<void>
  createAssignment: (schemeId: string, input: CreateAssignmentInput) => Promise<void>
  deleteAssignment: (schemeId: string, id: string) => Promise<void>
  runCalculation: (schemeId: string) => Promise<void>
  updateRiskStatus: (schemeId: string, riskId: string, status: string) => Promise<void>
  createSnapshot: (schemeId: string) => Promise<void>
  setActiveTab: (tab: 'points' | 'fixtures' | 'force' | 'verification' | 'risks') => void
}

export const useStore = create<StoreState>((set, get) => ({
  currentSchemeId: null,
  schemes: [],
  schemeDetail: null,
  fixtures: [],
  risks: [],
  isLoading: false,
  error: null,
  activeTab: 'points',

  fetchSchemes: async () => {
    set({ isLoading: true, error: null })
    try {
      const schemes = await api.listSchemes()
      set({ schemes, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  selectScheme: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const [schemeDetail, fixtures, risks] = await Promise.all([
        api.getScheme(id),
        api.listFixtures(),
        api.getRisks(id),
      ])
      set({ currentSchemeId: id, schemeDetail, fixtures, risks, isLoading: false })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  createScheme: async (input) => {
    set({ error: null })
    try {
      await api.createScheme(input)
      await get().fetchSchemes()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  updateScheme: async (id, input) => {
    set({ error: null })
    try {
      await api.updateScheme(id, input)
      await get().fetchSchemes()
      if (get().currentSchemeId === id) {
        const schemeDetail = await api.getScheme(id)
        set({ schemeDetail })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteScheme: async (id) => {
    set({ error: null })
    try {
      await api.deleteScheme(id)
      if (get().currentSchemeId === id) {
        set({ currentSchemeId: null, schemeDetail: null, risks: [] })
      }
      await get().fetchSchemes()
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createPoint: async (schemeId, input) => {
    set({ error: null })
    try {
      await api.createPoint(schemeId, input)
      if (get().currentSchemeId === schemeId) {
        const schemeDetail = await api.getScheme(schemeId)
        set({ schemeDetail })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  updatePoint: async (schemeId, pointId, input) => {
    set({ error: null })
    try {
      await api.updatePoint(schemeId, pointId, input)
      if (get().currentSchemeId === schemeId) {
        const schemeDetail = await api.getScheme(schemeId)
        set({ schemeDetail })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deletePoint: async (schemeId, pointId) => {
    set({ error: null })
    try {
      await api.deletePoint(schemeId, pointId)
      if (get().currentSchemeId === schemeId) {
        const schemeDetail = await api.getScheme(schemeId)
        set({ schemeDetail })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createFixture: async (input) => {
    set({ error: null })
    try {
      await api.createFixture(input)
      const fixtures = await api.listFixtures()
      set({ fixtures })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  updateFixture: async (id, input) => {
    set({ error: null })
    try {
      await api.updateFixture(id, input)
      const fixtures = await api.listFixtures()
      set({ fixtures })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteFixture: async (id) => {
    set({ error: null })
    try {
      await api.deleteFixture(id)
      const fixtures = await api.listFixtures()
      set({ fixtures })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createAssignment: async (schemeId, input) => {
    set({ error: null })
    try {
      await api.createAssignment(schemeId, input)
      if (get().currentSchemeId === schemeId) {
        const schemeDetail = await api.getScheme(schemeId)
        set({ schemeDetail })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteAssignment: async (schemeId, id) => {
    set({ error: null })
    try {
      await api.deleteAssignment(schemeId, id)
      if (get().currentSchemeId === schemeId) {
        const schemeDetail = await api.getScheme(schemeId)
        set({ schemeDetail })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  runCalculation: async (schemeId) => {
    set({ isLoading: true, error: null })
    try {
      const [decompositions, verifications, risks] = await Promise.all([
        api.decompose(schemeId),
        api.verify(schemeId),
        api.detectRisks(schemeId),
      ])
      const schemeDetail = get().schemeDetail
      if (schemeDetail && get().currentSchemeId === schemeId) {
        set({
          schemeDetail: { ...schemeDetail, decompositions, verifications },
          risks,
          isLoading: false,
        })
      } else {
        set({ risks, isLoading: false })
      }
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  updateRiskStatus: async (schemeId, riskId, status) => {
    set({ error: null })
    try {
      const updated = await api.updateRiskStatus(schemeId, riskId, status)
      set({ risks: get().risks.map((r) => (r.id === riskId ? updated : r)) })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  createSnapshot: async (schemeId) => {
    set({ error: null })
    try {
      await api.createSnapshot(schemeId)
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab })
  },
}))
