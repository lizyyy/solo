import { create } from 'zustand'
import { api, type Batch, type ConfirmationRecord, type Discrepancy, type AuditLog, type ReplayData } from '@/lib/api'

type WorkflowStep = 1 | 2 | 3

interface AppState {
  currentBatch: Batch | null
  records: ConfirmationRecord[]
  discrepancies: Discrepancy[]
  auditLogs: AuditLog[]
  replayData: ReplayData | null
  workflowStep: WorkflowStep
  selectedDiscrepancy: Discrepancy | null
  loading: boolean
  error: string | null

  fetchBatches: () => Promise<Batch[]>
  createBatch: (name: string) => Promise<Batch>
  fetchBatchDetail: (id: string) => Promise<void>
  fetchRecords: (filters?: Record<string, string>) => Promise<void>
  importRecords: (batchId: string, data: Record<string, unknown>[]) => Promise<void>
  taxRemarkReview: (batchId: string, data: Record<string, unknown>[]) => Promise<void>
  fetchDiscrepancies: (filters?: Record<string, string>) => Promise<void>
  fetchDiscrepancyDetail: (id: string) => Promise<void>
  resolveConflict: (id: string, resolution: { decidedBy: string; decision: string; reason: string }) => Promise<void>
  compareBatch: (batchId: string) => Promise<void>
  fetchAuditLogs: (filters?: Record<string, string>) => Promise<void>
  fetchReplayCommand: (batchId: string) => Promise<void>
  executeReplay: (batchId: string) => Promise<void>
  setWorkflowStep: (step: WorkflowStep) => void
  setSelectedDiscrepancy: (d: Discrepancy | null) => void
  clearError: () => void
}

const stepFromStatus = (status: string): WorkflowStep => {
  if (status === 'importing') return 1
  if (status === 'comparing') return 2
  return 3
}

export const useStore = create<AppState>((set, get) => ({
  currentBatch: null,
  records: [],
  discrepancies: [],
  auditLogs: [],
  replayData: null,
  workflowStep: 1,
  selectedDiscrepancy: null,
  loading: false,
  error: null,

  fetchBatches: async () => {
    set({ loading: true, error: null })
    try {
      const batches = await api.getBatches()
      if (batches.length > 0) {
        const latest = batches[0]
        set({ currentBatch: latest, workflowStep: stepFromStatus(latest.status) })
      }
      set({ loading: false })
      return batches
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
      return []
    }
  },

  createBatch: async (name: string) => {
    set({ loading: true, error: null })
    try {
      const batch = await api.createBatch(name)
      set({ currentBatch: batch, workflowStep: 1, loading: false })
      return batch
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
      throw e
    }
  },

  fetchBatchDetail: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const detail = await api.getBatchDetail(id)
      set({
        currentBatch: detail,
        records: detail.records || [],
        discrepancies: detail.discrepancies || [],
        workflowStep: stepFromStatus(detail.status),
        loading: false,
      })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchRecords: async (filters?: Record<string, string>) => {
    set({ loading: true, error: null })
    try {
      const records = await api.getRecords(filters)
      set({ records, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  importRecords: async (batchId, data) => {
    set({ loading: true, error: null })
    try {
      await api.importRecords(batchId, data)
      await get().fetchBatchDetail(batchId)
      set({ workflowStep: 2, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  taxRemarkReview: async (batchId, data) => {
    set({ loading: true, error: null })
    try {
      await api.taxRemarkReview(batchId, data)
      await get().fetchBatchDetail(batchId)
      set({ workflowStep: 3, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchDiscrepancies: async (filters?: Record<string, string>) => {
    set({ loading: true, error: null })
    try {
      const discrepancies = await api.getDiscrepancies(filters)
      set({ discrepancies, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchDiscrepancyDetail: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const detail = await api.getDiscrepancyDetail(id)
      set({ selectedDiscrepancy: detail, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  resolveConflict: async (id, resolution) => {
    set({ loading: true, error: null })
    try {
      const updated = await api.resolveConflict(id, resolution)
      const { discrepancies } = get()
      set({
        discrepancies: discrepancies.map(d => d.id === updated.id ? updated : d),
        selectedDiscrepancy: null,
        loading: false,
      })
      const batchId = updated.batch_id
      if (batchId) await get().fetchBatchDetail(batchId)
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  compareBatch: async (batchId) => {
    set({ loading: true, error: null })
    try {
      await api.compareBatch(batchId)
      await get().fetchBatchDetail(batchId)
      set({ workflowStep: 3, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchAuditLogs: async (filters?: Record<string, string>) => {
    set({ loading: true, error: null })
    try {
      const logs = await api.getAuditLogs(filters)
      set({ auditLogs: logs, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchReplayCommand: async (batchId) => {
    set({ loading: true, error: null })
    try {
      const data = await api.getReplayCommand(batchId)
      set({ replayData: data, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  executeReplay: async (batchId) => {
    set({ loading: true, error: null })
    try {
      await api.executeReplay(batchId)
      await get().fetchAuditLogs({ batchId })
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  setWorkflowStep: (step) => set({ workflowStep: step }),
  setSelectedDiscrepancy: (d) => set({ selectedDiscrepancy: d }),
  clearError: () => set({ error: null }),
}))
