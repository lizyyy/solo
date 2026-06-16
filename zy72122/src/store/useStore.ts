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
import { convertValue } from '@/utils/unitConverter'

function normalizeRecordUnits(
  partial: Omit<ExperimentRecord, 'id' | 'processedAt' | 'status'>,
  config: ValidationConfig
): {
  record: Omit<ExperimentRecord, 'id' | 'processedAt' | 'status'>
  converted: boolean
  conversionNote: string
} {
  const conversions: string[] = []
  const originalValues: ExperimentRecord['originalValues'] = {}
  const result = { ...partial }

  if (partial.displacementUnit !== config.expectedDisplacementUnit) {
    const converted = convertValue(
      partial.displacement,
      partial.displacementUnit,
      config.expectedDisplacementUnit,
      'displacement'
    )
    if (converted !== null) {
      originalValues.displacement = partial.displacement
      originalValues.displacementUnit = partial.displacementUnit
      result.displacement = converted
      result.displacementUnit = config.expectedDisplacementUnit
      conversions.push(
        `位移 ${partial.displacement}${partial.displacementUnit} → ${converted.toFixed(2)}${config.expectedDisplacementUnit}`
      )
    }
  }

  if (partial.forceUnit !== config.expectedForceUnit) {
    const converted = convertValue(
      partial.force,
      partial.forceUnit,
      config.expectedForceUnit,
      'force'
    )
    if (converted !== null) {
      originalValues.force = partial.force
      originalValues.forceUnit = partial.forceUnit
      result.force = converted
      result.forceUnit = config.expectedForceUnit
      conversions.push(
        `力 ${partial.force}${partial.forceUnit} → ${converted.toFixed(2)}${config.expectedForceUnit}`
      )
    }
  }

  if (partial.stiffnessUnit !== config.expectedStiffnessUnit) {
    const converted = convertValue(
      partial.springStiffness,
      partial.stiffnessUnit,
      config.expectedStiffnessUnit,
      'stiffness'
    )
    if (converted !== null) {
      originalValues.springStiffness = partial.springStiffness
      originalValues.stiffnessUnit = partial.stiffnessUnit
      result.springStiffness = converted
      result.stiffnessUnit = config.expectedStiffnessUnit
      conversions.push(
        `刚度 ${partial.springStiffness}${partial.stiffnessUnit} → ${converted.toFixed(2)}${config.expectedStiffnessUnit}`
      )
    }
  }

  const converted = conversions.length > 0
  if (converted && Object.keys(originalValues).length > 0) {
    ;(result as ExperimentRecord).originalValues = originalValues
  }

  return {
    record: result,
    converted,
    conversionNote: conversions.join('；'),
  }
}

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
        const config = get().config
        const normalized = normalizeRecordUnits(partial, config)
        const record: ExperimentRecord = {
          ...normalized.record,
          id: generateId(),
          processedAt: nowISO(),
          status: 'passed',
        }
        if (normalized.converted) {
          record.amendedFrom = normalized.conversionNote
        }

        const sorted = [...get().records, record].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        const idx = sorted.findIndex((r) => r.id === record.id)
        const prev = idx > 0 ? sorted[idx - 1] : null

        const vr = validateRecord(record, prev, config)
        record.status = determineRecordStatus(vr, record.source.type)

        const auditEntry: AuditEntry = {
          id: generateId(),
          recordId: record.id,
          action: normalized.converted ? 'amended' : 'created',
          timestamp: nowISO(),
          operator: '项目助理',
          details: normalized.converted
            ? `录入记录并换算单位：${normalized.conversionNote}，来源=${record.source.type === 'photo' ? '现场照片' : record.source.type === 'manual' ? '手工记录' : '旧口径'}(${record.source.reference})`
            : `录入记录：力=${record.force}${record.forceUnit}，位移=${record.displacement}${record.displacementUnit}，来源=${record.source.type === 'photo' ? '现场照片' : record.source.type === 'manual' ? '手工记录' : '旧口径'}(${record.source.reference})`,
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
        const config = get().config
        const newRecords: ExperimentRecord[] = []
        const newAudit: AuditEntry[] = []

        for (const partial of partials) {
          const normalized = normalizeRecordUnits(partial, config)
          const record: ExperimentRecord = {
            ...normalized.record,
            id: generateId(),
            processedAt: nowISO(),
            status: 'passed',
          }
          if (normalized.converted) {
            record.amendedFrom = normalized.conversionNote
          }
          newRecords.push(record)
        }

        const allRecords = [...get().records, ...newRecords].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        for (const record of newRecords) {
          const idx = allRecords.findIndex((r) => r.id === record.id)
          const prev = idx > 0 ? allRecords[idx - 1] : null
          const vr = validateRecord(record, prev, config)
          record.status = determineRecordStatus(vr, record.source.type)

          const hasConversion = !!record.amendedFrom
          newAudit.push({
            id: generateId(),
            recordId: record.id,
            action: hasConversion ? 'amended' : 'appended',
            timestamp: nowISO(),
            operator: '项目助理',
            details: hasConversion
              ? `批量录入并换算单位：${record.amendedFrom}`
              : `批量录入：力=${record.force}${record.forceUnit}，位移=${record.displacement}${record.displacementUnit}`,
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
        const normalizedRecords = records.map((r) => {
          const { id, processedAt, status, ...rest } = r
          const normalized = normalizeRecordUnits(rest, config)
          const result: ExperimentRecord = {
            ...normalized.record,
            id,
            processedAt,
            status,
          }
          if (normalized.converted) {
            result.amendedFrom = normalized.conversionNote
          } else if (r.amendedFrom) {
            result.amendedFrom = r.amendedFrom
          }
          if (r.originalValues) {
            result.originalValues = r.originalValues
          }
          return result
        })
        const vr = validateAll(normalizedRecords, config)
        const updatedRecords = normalizedRecords.map((r) => {
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
