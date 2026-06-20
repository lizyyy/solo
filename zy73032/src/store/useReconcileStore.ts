import { create } from 'zustand'
import { api } from '../utils/apiClient'
import type {
  Schedule,
  MedicalRecord,
  SummaryStats,
  AnomalyItem,
  OperationLog,
} from '../types'

interface ReconcileState {
  loading: boolean
  error: string | null
  stats: SummaryStats | null
  schedules: Schedule[]
  anomalies: AnomalyItem[]
  logs: OperationLog[]
  operator: string
  expandedScheduleId: number | null
  expandedLogId: number | null
  expandedMedicalForSchedule: Record<number, MedicalRecord[]>

  setOperator: (name: string) => void
  setExpandedSchedule: (id: number | null) => void
  setExpandedLog: (id: number | null) => void

  fetchAll: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchSchedules: () => Promise<void>
  fetchAnomalies: () => Promise<void>
  fetchLogs: () => Promise<void>

  importCsv: (csvText: string, label: string) => Promise<void>
  addMedicalRecord: (data: {
    pet_name: string
    visit_date: string
    diagnosis: string
    treatment: string
    veterinarian: string
  }) => Promise<MedicalRecord>

  confirmSchedule: (id: number, remark?: string) => Promise<void>
  withdrawSchedule: (id: number, remark?: string) => Promise<void>
  bindAlias: (aliasName: string, canonicalName: string) => Promise<void>

  resetDemo: () => Promise<void>
}

export const useReconcileStore = create<ReconcileState>((set, get) => ({
  loading: false,
  error: null,
  stats: null,
  schedules: [],
  anomalies: [],
  logs: [],
  operator: '小乔',
  expandedScheduleId: null,
  expandedLogId: null,
  expandedMedicalForSchedule: {},

  setOperator: (name: string) => set({ operator: name }),
  setExpandedSchedule: (id) => set({ expandedScheduleId: id }),
  setExpandedLog: (id) => set({ expandedLogId: id }),

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const [statsRes, schedRes, anomRes, logsRes] = await Promise.all([
        api.getSummary(),
        api.getSchedules(),
        api.getAnomalies(),
        api.getLogs(),
      ])
      set({
        stats: statsRes,
        schedules: schedRes.items,
        anomalies: anomRes.items,
        logs: logsRes.items,
        loading: false,
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.getSummary()
      set({ stats })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  fetchSchedules: async () => {
    try {
      const res = await api.getSchedules()
      set({ schedules: res.items })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  fetchAnomalies: async () => {
    try {
      const res = await api.getAnomalies()
      set({ anomalies: res.items })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  fetchLogs: async () => {
    try {
      const res = await api.getLogs()
      set({ logs: res.items })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  importCsv: async (csvText, label) => {
    set({ loading: true, error: null })
    try {
      await api.importCsv(csvText, label)
      await get().fetchAll()
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      throw err
    }
  },

  addMedicalRecord: async (data) => {
    set({ loading: true, error: null })
    try {
      const result = await api.addMedicalRecord({
        ...data,
        source_row: `manual:${Date.now()}`,
      })
      await get().fetchAll()
      return result
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      throw err
    }
  },

  confirmSchedule: async (id, remark = '') => {
    try {
      await api.confirmSchedule(id, get().operator, remark)
      await get().fetchAll()
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  withdrawSchedule: async (id, remark = '') => {
    try {
      await api.withdrawSchedule(id, get().operator, remark)
      await get().fetchAll()
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  bindAlias: async (aliasName, canonicalName) => {
    try {
      await api.bindAlias(aliasName, canonicalName, get().operator)
      await get().fetchAll()
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  resetDemo: async () => {
    set({ loading: true, error: null })
    try {
      await api.seedDemo()
      await get().fetchAll()
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
}))
