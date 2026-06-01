import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalcBatch, SensorRecord, EquipmentParams, FieldNote, ManualCorrection, ConflictRecord } from '@/types'
import { calculatePumpHead, detectConflicts } from '@/utils/pumpCalc'
import { checkThresholds, generateSuggestions } from '@/utils/thresholdCheck'

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_PARAMS: EquipmentParams = {
  pumpModel: 'IS80-65-160',
  ratedHead: 32,
  ratedHeadUnit: 'm',
  ratedFlow: 50,
  ratedFlowUnit: 'm³/h',
  pipeDiameter: 200,
  pipeDiameterUnit: 'mm',
  pipeLength: 150,
  pipeLengthUnit: 'm',
  roughness: 0.2,
  efficiency: 75,
  suctionPressure: 0.5,
  suctionPressureUnit: 'kgf/cm²',
  dischargePressure: 3.5,
  dischargePressureUnit: 'kgf/cm²',
  fluidDensity: 1.0,
  fluidDensityUnit: 'g/cm³',
  elevationDiff: 8,
  elevationDiffUnit: 'm',
  localLossCoeff: 5.0,
}

const SAMPLE_RECORDS: SensorRecord[] = [
  { id: uid(), parameterName: '进口压力', rawValue: 0.48, rawUnit: 'kgf/cm²', standardValue: 47073, standardUnit: 'Pa', timestamp: '2026-06-01T08:00:00', direction: '吸入', source: '巡检表', validated: true, validationMessage: '' },
  { id: uid(), parameterName: '出口压力', rawValue: 3.2, rawUnit: 'kgf/cm²', standardValue: 313813, standardUnit: 'Pa', timestamp: '2026-06-01T08:00:00', direction: '排出', source: '传感器', validated: true, validationMessage: '' },
  { id: uid(), parameterName: '流量', rawValue: 45, rawUnit: 'm³/h', standardValue: 0.0125, standardUnit: 'm³/s', timestamp: '2026-06-01T08:00:00', direction: '', source: '传感器', validated: true, validationMessage: '' },
  { id: uid(), parameterName: '温度', rawValue: 22, rawUnit: '°C', standardValue: 295.15, standardUnit: 'K', timestamp: '2026-06-01T08:05:00', direction: '', source: '传感器', validated: true, validationMessage: '' },
  { id: uid(), parameterName: '振动值', rawValue: 3.2, rawUnit: 'mm/s', standardValue: 0.0032, standardUnit: 'm/s', timestamp: '2026-06-01T08:10:00', direction: '', source: '巡检表', validated: true, validationMessage: '' },
]

const SAMPLE_NOTES: FieldNote[] = [
  { id: uid(), content: '出口阀门开度约70%，说是上周调的', noteTime: '2026-06-01T08:15:00', author: '老唐' },
  { id: uid(), content: '进口滤网看着有点脏，下次得洗', noteTime: '2026-06-01T08:16:00', author: '老唐' },
  { id: uid(), content: '这泵上周刚换过密封，跑了一周看看', noteTime: '2026-06-01T08:17:00', author: '老唐' },
]

interface StoreState {
  batches: CalcBatch[]
  currentBatchId: string | null
  createBatch: (operatorName?: string) => string
  deleteBatch: (id: string) => void
  setCurrentBatch: (id: string) => void
  getCurrentBatch: () => CalcBatch | undefined
  updateSensorRecords: (batchId: string, records: SensorRecord[]) => void
  addSensorRecord: (batchId: string, record: SensorRecord) => void
  removeSensorRecord: (batchId: string, recordId: string) => void
  updateEquipmentParams: (batchId: string, params: Partial<EquipmentParams>) => void
  updateFieldNotes: (batchId: string, notes: FieldNote[]) => void
  addFieldNote: (batchId: string, note: FieldNote) => void
  removeFieldNote: (batchId: string, noteId: string) => void
  addCorrection: (batchId: string, correction: ManualCorrection) => void
  resolveConflict: (batchId: string, conflictId: string, side: 'inspection' | 'imported') => void
  runCalculation: (batchId: string) => void
  loadSampleData: () => string
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      batches: [],
      currentBatchId: null,

      createBatch: (operatorName = '') => {
        const id = uid()
        const batch: CalcBatch = {
          id,
          createTime: new Date().toISOString(),
          processTime: '',
          operatorName,
          source: '手动录入',
          sensorRecords: [],
          equipmentParams: { ...DEFAULT_PARAMS },
          fieldNotes: [],
          corrections: [],
          result: null,
          alerts: [],
          suggestions: [],
          conflicts: [],
        }
        set((s) => ({ batches: [...s.batches, batch], currentBatchId: id }))
        return id
      },

      deleteBatch: (id) => {
        set((s) => ({
          batches: s.batches.filter((b) => b.id !== id),
          currentBatchId: s.currentBatchId === id ? null : s.currentBatchId,
        }))
      },

      setCurrentBatch: (id) => set({ currentBatchId: id }),

      getCurrentBatch: () => {
        const s = get()
        return s.batches.find((b) => b.id === s.currentBatchId)
      },

      updateSensorRecords: (batchId, records) => {
        set((s) => ({
          batches: s.batches.map((b) => b.id === batchId ? { ...b, sensorRecords: records } : b),
        }))
      },

      addSensorRecord: (batchId, record) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, sensorRecords: [...b.sensorRecords, record] }
              : b
          ),
        }))
      },

      removeSensorRecord: (batchId, recordId) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, sensorRecords: b.sensorRecords.filter((r) => r.id !== recordId) }
              : b
          ),
        }))
      },

      updateEquipmentParams: (batchId, params) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, equipmentParams: { ...b.equipmentParams, ...params } }
              : b
          ),
        }))
      },

      updateFieldNotes: (batchId, notes) => {
        set((s) => ({
          batches: s.batches.map((b) => b.id === batchId ? { ...b, fieldNotes: notes } : b),
        }))
      },

      addFieldNote: (batchId, note) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, fieldNotes: [...b.fieldNotes, note] }
              : b
          ),
        }))
      },

      removeFieldNote: (batchId, noteId) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, fieldNotes: b.fieldNotes.filter((n) => n.id !== noteId) }
              : b
          ),
        }))
      },

      addCorrection: (batchId, correction) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? { ...b, corrections: [...b.corrections, correction] }
              : b
          ),
        }))
      },

      resolveConflict: (batchId, conflictId, side) => {
        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? {
                  ...b,
                  conflicts: b.conflicts.map((c) =>
                    c.id === conflictId ? { ...c, resolved: true, chosenSide: side } : c
                  ),
                }
              : b
          ),
        }))
      },

      runCalculation: (batchId) => {
        const state = get()
        const batch = state.batches.find((b) => b.id === batchId)
        if (!batch) return

        const result = calculatePumpHead(batch.equipmentParams, batch.sensorRecords)
        const alerts = checkThresholds(result)
        const suggestions = generateSuggestions(result, alerts)
        const conflicts = detectConflicts(batch.equipmentParams, batch.sensorRecords)

        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? {
                  ...b,
                  result,
                  alerts,
                  suggestions,
                  conflicts: [...b.conflicts.filter((c) => !conflicts.some((nc) => nc.fieldName === c.fieldName)), ...conflicts],
                  processTime: new Date().toISOString(),
                }
              : b
          ),
        }))
      },

      loadSampleData: () => {
        const id = uid()
        const batch: CalcBatch = {
          id,
          createTime: new Date().toISOString(),
          processTime: '',
          operatorName: '老唐',
          source: '样例数据',
          sensorRecords: SAMPLE_RECORDS.map((r) => ({ ...r, id: uid() })),
          equipmentParams: { ...DEFAULT_PARAMS },
          fieldNotes: SAMPLE_NOTES.map((n) => ({ ...n, id: uid() })),
          corrections: [],
          result: null,
          alerts: [],
          suggestions: [],
          conflicts: [],
        }
        set((s) => ({ batches: [...s.batches, batch], currentBatchId: id }))
        return id
      },
    }),
    { name: 'pump-head-store' }
  )
)
