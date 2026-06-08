import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ExperimentRecord,
  AuditEntry,
  ValidationConfig,
  ValidationResult,
} from '@/types'
import { DEFAULT_CONFIG } from '@/types'
import { validateRecord, determineRecordStatus, validateAll } from '@/utils/validator'
import { generateId, nowISO } from '@/utils/helpers'
import { generateSampleData } from '@/utils/sampleData'

interface LabStore {
  records: ExperimentRecord[]
  auditLog: AuditEntry[]
  config: ValidationConfig
  validationResults: ValidationResult[]

  addRecord: (record: Omit<ExperimentRecord, 'id' | 'processedAt' | 'status'>) => void
  addRecords: (records: Omit<ExperimentRecord, 'id' | 'processedAt' | 'status'>[]) => void
  reviewRecord: (recordId: string, note: string) => void
  updateConfig: (config: Partial<ValidationConfig>) => void
  runValidation: () => void
  initSampleData: () => void
  clearAll: () => void
}

export const useStore = create<LabStore>()(
  persist(
    (set, get) => ({
      records: [],
      auditLog: [],
      config: DEFAULT_CONFIG,
      validationResults: [],

      addRecord: (partial) => {
        const record: ExperimentRecord = {
          ...partial,
          id: generateId(),
          processedAt: nowISO(),
          status: 'passed',
        }

        const sorted = [...get().records, record].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        const idx = sorted.findIndex((r) => r.id === record.id)
        const prev = idx > 0 ? sorted[idx - 1] : null

        const vr = validateRecord(record, prev, get().config)
        record.status = determineRecordStatus(vr, record.source.type)

        const auditEntry: AuditEntry = {
          id: generateId(),
          recordId: record.id,
          action: 'created',
          timestamp: nowISO(),
          operator: '项目助理',
          details: `录入记录：力=${record.force}${record.forceUnit}，位移=${record.displacement}${record.displacementUnit}，来源=${record.source.type === 'photo' ? '现场照片' : record.source.type === 'manual' ? '手工记录' : '旧口径'}(${record.source.reference})`,
          newStatus: record.status,
        }

        const validationAudit: AuditEntry = {
          id: generateId(),
          recordId: record.id,
          action: 'validated',
          timestamp: nowISO(),
          operator: '系统',
          details: vr.checks
            .map((c) => `${c.passed ? '✓' : '✗'} ${c.message}`)
            .join('；'),
          newStatus: record.status,
        }

        set((state) => ({
          records: [...state.records, record],
          auditLog: [...state.auditLog, auditEntry, validationAudit],
          validationResults: validateAll([...state.records, record], get().config),
        }))
      },

      addRecords: (partials) => {
        const newRecords: ExperimentRecord[] = []
        const newAudit: AuditEntry[] = []

        for (const partial of partials) {
          const record: ExperimentRecord = {
            ...partial,
            id: generateId(),
            processedAt: nowISO(),
            status: 'passed',
          }
          newRecords.push(record)
        }

        const allRecords = [...get().records, ...newRecords].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        for (const record of newRecords) {
          const idx = allRecords.findIndex((r) => r.id === record.id)
          const prev = idx > 0 ? allRecords[idx - 1] : null
          const vr = validateRecord(record, prev, get().config)
          record.status = determineRecordStatus(vr, record.source.type)

          newAudit.push({
            id: generateId(),
            recordId: record.id,
            action: 'appended',
            timestamp: nowISO(),
            operator: '项目助理',
            details: `批量录入：力=${record.force}${record.forceUnit}，位移=${record.displacement}${record.displacementUnit}`,
            newStatus: record.status,
          })
        }

        set((state) => ({
          records: [...state.records, ...newRecords],
          auditLog: [...state.auditLog, ...newAudit],
          validationResults: validateAll(
            [...state.records, ...newRecords],
            get().config
          ),
        }))
      },

      reviewRecord: (recordId, note) => {
        const record = get().records.find((r) => r.id === recordId)
        if (!record) return

        const prevStatus = record.status
        const updatedRecords = get().records.map((r) =>
          r.id === recordId
            ? { ...r, status: 'passed' as const, reviewNote: note }
            : r
        )

        const auditEntry: AuditEntry = {
          id: generateId(),
          recordId,
          action: 'reviewed',
          timestamp: nowISO(),
          operator: '项目助理',
          details: `人工确认：${note}`,
          previousStatus: prevStatus,
          newStatus: 'passed',
        }

        set((state) => ({
          records: updatedRecords,
          auditLog: [...state.auditLog, auditEntry],
          validationResults: validateAll(updatedRecords, get().config),
        }))
      },

      updateConfig: (partial) => {
        const newConfig = { ...get().config, ...partial }
        set((state) => ({
          config: newConfig,
          validationResults: validateAll(state.records, newConfig),
        }))
      },

      runValidation: () => {
        set((state) => ({
          validationResults: validateAll(state.records, state.config),
        }))
      },

      initSampleData: () => {
        const { records, audit } = generateSampleData()
        const config = get().config
        const vr = validateAll(records, config)
        const updatedRecords = records.map((r) => {
          const result = vr.find((v) => v.recordId === r.id)
          const computedStatus = result ? determineRecordStatus(result, r.source.type) : r.status
          return { ...r, status: computedStatus }
        })
        set({
          records: updatedRecords,
          auditLog: audit,
          validationResults: validateAll(updatedRecords, config),
        })
      },

      clearAll: () => {
        set({
          records: [],
          auditLog: [],
          validationResults: [],
          config: DEFAULT_CONFIG,
        })
      },
    }),
    {
      name: 'spring-lab-store',
      version: 3,
      migrate: (persisted: Record<string, unknown>, version: number) => {
        if (version < 2) {
          return {
            ...persisted,
            config: DEFAULT_CONFIG,
          }
        }
        if (version < 3) {
          const records = (persisted as Record<string, unknown>).records as ExperimentRecord[]
          if (records && records.length > 0) {
            const updatedRecords = records.map((r) => {
              const vr = validateAll(records, DEFAULT_CONFIG)
              const result = vr.find((v) => v.recordId === r.id)
              const computedStatus = result ? determineRecordStatus(result, r.source.type) : r.status
              return { ...r, status: computedStatus }
            })
            return { ...persisted, records: updatedRecords, config: DEFAULT_CONFIG }
          }
          return { ...persisted, config: DEFAULT_CONFIG }
        }
        return persisted
      },
      partialize: (state) => ({
        records: state.records,
        auditLog: state.auditLog,
        config: state.config,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.records.length > 0) {
          state.validationResults = validateAll(state.records, state.config)
        }
      },
    }
  )
)
