import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalcBatch, SensorRecord, EquipmentParams, FieldNote, ManualCorrection, ConflictRecord } from '@/types'
import { calculatePumpHead, detectConflicts } from '@/utils/pumpCalc'
import { checkThresholds, generateSuggestions } from '@/utils/thresholdCheck'
import { convertToSI } from '@/utils/unitConversion'

function toSI(value: number, unit: string, category?: string): number {
  const result = convertToSI(value, unit, category)
  return result.convertedValue ?? value
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const EQUIPMENT_FIELD_MAP: Record<string, { valueKey: keyof EquipmentParams; unitKey?: keyof EquipmentParams; category: string }> = {
  '额定扬程': { valueKey: 'ratedHead', unitKey: 'ratedHeadUnit', category: 'length' },
  '额定流量': { valueKey: 'ratedFlow', unitKey: 'ratedFlowUnit', category: 'flow' },
  '管径': { valueKey: 'pipeDiameter', unitKey: 'pipeDiameterUnit', category: 'diameter' },
  '管长': { valueKey: 'pipeLength', unitKey: 'pipeLengthUnit', category: 'length' },
  '粗糙度': { valueKey: 'roughness', category: 'roughness' },
  '吸入压力': { valueKey: 'suctionPressure', unitKey: 'suctionPressureUnit', category: 'pressure' },
  '排出压力': { valueKey: 'dischargePressure', unitKey: 'dischargePressureUnit', category: 'pressure' },
  '流体密度': { valueKey: 'fluidDensity', unitKey: 'fluidDensityUnit', category: 'dimensionless' },
  '高程差': { valueKey: 'elevationDiff', unitKey: 'elevationDiffUnit', category: 'length' },
  '局部损失系数': { valueKey: 'localLossCoeff', category: 'dimensionless' },
  '效率': { valueKey: 'efficiency', category: 'dimensionless' },
  '泵效率': { valueKey: 'efficiency', category: 'dimensionless' },
}

const SENSOR_FIELD_MAP: Record<string, { paramKey: string; unitKey?: string }> = {
  '流量': { paramKey: '流量' },
  '进口压力': { paramKey: '进口压力' },
  '吸入压力': { paramKey: '进口压力' },
  '出口压力': { paramKey: '出口压力' },
  '排出压力': { paramKey: '出口压力' },
  '温度': { paramKey: '温度' },
  '振动值': { paramKey: '振动值' },
}

const STANDARD_UNIT_MAP: Record<string, string> = {
  pressure: 'Pa',
  flow: 'm³/s',
  temperature: 'K',
  velocity: 'm/s',
  length: 'm',
  diameter: 'm',
  roughness: 'm',
  dimensionless: '',
}

function getCategoryByParamName(paramName: string): string {
  if (paramName.includes('压力')) return 'pressure'
  if (paramName.includes('流量')) return 'flow'
  if (paramName.includes('温度')) return 'temperature'
  if (paramName.includes('振动') || paramName.includes('速度')) return 'velocity'
  if (paramName.includes('管径')) return 'diameter'
  if (paramName.includes('管长') || paramName.includes('扬程') || paramName.includes('高程')) return 'length'
  if (paramName.includes('粗糙')) return 'roughness'
  return 'dimensionless'
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

        let effectiveParams: EquipmentParams = { ...batch.equipmentParams }
        let effectiveRecords: SensorRecord[] = batch.sensorRecords.map((r) => ({ ...r }))

        batch.corrections.forEach((corr) => {
          const eqMap = EQUIPMENT_FIELD_MAP[corr.fieldName]
          if (eqMap) {
            ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.valueKey as string] = corr.correctedValue
            if (eqMap.unitKey && corr.correctedUnit) {
              ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.unitKey as string] = corr.correctedUnit
            }
          } else {
            const sensorMap = SENSOR_FIELD_MAP[corr.fieldName]
            if (sensorMap) {
              const idx = effectiveRecords.findIndex((r) => r.parameterName === sensorMap.paramKey)
              if (idx !== -1) {
                const category = getCategoryByParamName(sensorMap.paramKey)
                const standardVal = toSI(corr.correctedValue, corr.correctedUnit || effectiveRecords[idx].rawUnit, category)
                const standardUnit = STANDARD_UNIT_MAP[category] || effectiveRecords[idx].standardUnit
                effectiveRecords[idx] = {
                  ...effectiveRecords[idx],
                  rawValue: corr.correctedValue,
                  rawUnit: corr.correctedUnit || effectiveRecords[idx].rawUnit,
                  standardValue: standardVal,
                  standardUnit,
                }
              }
            }
          }
        })

        batch.conflicts.forEach((c) => {
          if (!c.resolved || !c.chosenSide) return
          if (c.fieldName === '吸入压力' || c.fieldName === '排出压力') {
            const eqMap = EQUIPMENT_FIELD_MAP[c.fieldName]
            if (!eqMap) return
            const recordKey = c.fieldName === '吸入压力' ? '进口压力' : '出口压力'
            const record = effectiveRecords.find((r) => r.parameterName === recordKey)
            if (c.chosenSide === 'inspection') {
              // nothing to do, already using params
            } else if (c.chosenSide === 'imported' && record) {
              ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.valueKey as string] = record.rawValue
              if (eqMap.unitKey) {
                ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.unitKey as string] = record.rawUnit
              }
            }
          }
        })

        const result = calculatePumpHead(effectiveParams, effectiveRecords)
        const alerts = checkThresholds(result)
        const suggestions = generateSuggestions(result, alerts)
        const conflicts = detectConflicts(effectiveParams, effectiveRecords)

        const resolvedMap = new Map(batch.conflicts.filter((c) => c.resolved).map((c) => [c.fieldName, c]))
        const mergedConflicts = conflicts.map((nc) => {
          const old = resolvedMap.get(nc.fieldName)
          if (old) return { ...nc, resolved: true, chosenSide: old.chosenSide }
          return nc
        })
        const oldUnmatched = batch.conflicts.filter((c) => !conflicts.some((nc) => nc.fieldName === c.fieldName))

        set((s) => ({
          batches: s.batches.map((b) =>
            b.id === batchId
              ? {
                  ...b,
                  result,
                  alerts,
                  suggestions,
                  conflicts: [...oldUnmatched, ...mergedConflicts],
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
