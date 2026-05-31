import type { EvidenceItem, AuditResult } from '@/types'
import { runAuditEngine, generateId } from './auditEngine'
import { persist } from 'zustand/middleware'
import { create } from 'zustand'

interface AppState {
  evidences: EvidenceItem[]
  auditResults: AuditResult[]
  addEvidence: (item: Omit<EvidenceItem, 'id'>) => void
  removeEvidence: (id: string) => void
  confirmAudit: (id: string, by: string, note: string) => void
  rejectAudit: (id: string, reason: string, corrected: string) => void
  runAudit: () => void
  exportChain: () => string
  importChain: (json: string) => void
  resetData: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      evidences: [],
      auditResults: [],

      addEvidence: (item) => {
        const id = generateId()
        const newItem: EvidenceItem = { ...item, id }
        set((state) => {
          const evidences = [...state.evidences, newItem]
          const auditResults = runAuditEngine(evidences, state.auditResults)
          return { evidences, auditResults }
        })
      },

      removeEvidence: (id) => {
        set((state) => {
          const evidences = state.evidences.filter((e) => e.id !== id)
          const auditResults = state.auditResults.filter((r) => r.evidenceId !== id)
          return { evidences, auditResults }
        })
      },

      confirmAudit: (id, by, note) => {
        set((state) => ({
          auditResults: state.auditResults.map((r) =>
            r.id === id
              ? { ...r, status: 'confirmed' as const, confirmedBy: by, confirmedAt: new Date().toISOString(), confirmNote: note }
              : r
          ),
        }))
      },

      rejectAudit: (id, reason, corrected) => {
        set((state) => ({
          auditResults: state.auditResults.map((r) =>
            r.id === id
              ? { ...r, status: 'rejected' as const, rejectReason: reason, correctedConclusion: corrected }
              : r
          ),
        }))
      },

      runAudit: () => {
        set((state) => ({
          auditResults: runAuditEngine(state.evidences, state.auditResults),
        }))
      },

      exportChain: () => {
        const { evidences, auditResults } = get()
        return JSON.stringify({ evidences, auditResults, exportedAt: new Date().toISOString() }, null, 2)
      },

      importChain: (json) => {
        try {
          const data = JSON.parse(json)
          if (data.evidences && data.auditResults) {
            set({ evidences: data.evidences, auditResults: data.auditResults })
          }
        } catch {
          console.error('导入失败：JSON 格式无效')
        }
      },

      resetData: () => {
        set({ evidences: [], auditResults: [] })
      },
    }),
    {
      name: 'evidence-chain-storage',
    }
  )
)
