import { create } from 'zustand'
import type {
  Model,
  Report,
  Conclusion,
  Evaluation,
  ChangeRecord,
  Bundle,
  MaterialRecord,
  ConsistencyResult,
  GuideSection,
} from '@/types'
import * as api from '@/api/client'

interface AppStore {
  models: Model[]
  reports: Report[]
  currentReport: {
    report: Report
    conclusions: Conclusion[]
    evaluations: Evaluation[]
    changeHistory: ChangeRecord[]
  } | null
  bundles: Bundle[]
  changes: ChangeRecord[]
  guideSections: GuideSection[]
  consistencyResult: ConsistencyResult | null
  loading: boolean
  error: string | null

  loadModels: () => Promise<void>
  loadReports: (params?: {
    modelId?: string
    date?: string
    severity?: string
    search?: string
  }) => Promise<void>
  loadReport: (id: string) => Promise<void>
  loadBundles: () => Promise<void>
  uploadBundle: (file: File) => Promise<void>
  confirmBundle: (id: string, modelId: string, date: string) => Promise<void>
  loadChanges: (params?: {
    reportId?: string
    entityType?: string
    operator?: string
  }) => Promise<void>
  createChange: (data: {
    entityType: string
    entityId: string
    reportId?: string
    fieldName: string
    oldValue: string
    newValue: string
    operator: string
  }) => Promise<void>
  checkConsistency: (reportId: string) => Promise<void>
  loadGuide: () => Promise<void>
  clearError: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  models: [],
  reports: [],
  currentReport: null,
  bundles: [],
  changes: [],
  guideSections: [],
  consistencyResult: null,
  loading: false,
  error: null,

  loadModels: async () => {
    set({ loading: true, error: null })
    try {
      const models = await api.fetchModels()
      set({ models, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadReports: async (params?) => {
    set({ loading: true, error: null })
    try {
      const reports = await api.fetchReports(params)
      set({ reports, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadReport: async (id) => {
    set({ loading: true, error: null })
    try {
      const currentReport = await api.fetchReport(id)
      set({ currentReport, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadBundles: async () => {
    set({ loading: true, error: null })
    try {
      const bundles = await api.fetchBundles()
      set({ bundles, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  uploadBundle: async (file) => {
    set({ loading: true, error: null })
    try {
      const result = await api.uploadBundle(file)
      set((state) => ({
        bundles: [...state.bundles, result.bundle],
        loading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  confirmBundle: async (id, modelId, date) => {
    set({ loading: true, error: null })
    try {
      const report = await api.confirmBundle(id, modelId, date)
      set((state) => ({
        reports: [...state.reports, report],
        bundles: state.bundles.map((b) =>
          b.id === id ? { ...b, status: 'confirmed' as const } : b,
        ),
        loading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadChanges: async (params?) => {
    set({ loading: true, error: null })
    try {
      const changes = await api.fetchChanges(params)
      set({ changes, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createChange: async (data) => {
    set({ loading: true, error: null })
    try {
      const change = await api.createChange(data)
      set((state) => ({
        changes: [...state.changes, change],
        loading: false,
      }))
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  checkConsistency: async (reportId) => {
    set({ loading: true, error: null })
    try {
      const consistencyResult = await api.checkConsistency(reportId)
      set({ consistencyResult, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadGuide: async () => {
    set({ loading: true, error: null })
    try {
      const guideSections = await api.fetchGuide()
      set({ guideSections, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
