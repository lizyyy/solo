import { create } from 'zustand'
import type { CalibrationRecord, ConflictEvidence, SelfCheckResult, PumpSpeedCurve, UserRole } from '@/types'

const MOCK_RECORDS: CalibrationRecord[] = [
  {
    id: 'rec-001',
    batchNo: 'BATCH-2024-0312',
    temperatureCalibration: '25.0°C',
    sensorNo: 'SN-8801',
    sensorNote: '现场校准温度25.0°C',
    mainMaterial: '316L不锈钢',
    coefficient: 1.0,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'normal',
    importedAt: '2024-03-12 09:15:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-002',
    batchNo: 'BATCH-2024-0315',
    temperatureCalibration: '22.5°C',
    sensorNo: 'SN-8802',
    sensorNote: '传感器记录温度28.0°C',
    mainMaterial: '304不锈钢',
    coefficient: 1.12,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'conflict',
    importedAt: '2024-03-15 14:20:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-003',
    batchNo: 'BATCH-2024-0318',
    temperatureCalibration: '23.0°C',
    sensorNo: 'SN-8803',
    sensorNote: '校准温度23.0°C',
    mainMaterial: '碳钢Q235',
    coefficient: 0.95,
    originalCoefficient: 1.0,
    coefficientChangeReason: null,
    status: 'pending_review',
    importedAt: '2024-03-18 10:30:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-004',
    batchNo: 'BATCH-2024-0312',
    temperatureCalibration: '25.0°C',
    sensorNo: 'SN-8801',
    sensorNote: '现场校准温度25.0°C',
    mainMaterial: '316L不锈钢',
    coefficient: 1.0,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'normal',
    importedAt: '2024-03-12 09:15:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-005',
    batchNo: 'BATCH-2024-0320',
    temperatureCalibration: '24.0°C',
    sensorNo: 'SN-8805',
    sensorNote: '传感器记录温度24.0°C',
    mainMaterial: '铝合金6061',
    coefficient: 0.88,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'normal',
    importedAt: '2024-03-20 16:45:00',
    reviewedBy: null,
    reviewedAt: null,
  },
]

const MOCK_CONFLICTS: ConflictEvidence[] = [
  {
    id: 'conf-001',
    recordId: 'rec-002',
    field: '温度',
    calibrationValue: '22.5°C',
    sensorValue: '28.0°C',
    severity: 'high',
    resolution: 'pending',
    resolvedBy: null,
    resolvedAt: null,
  },
  {
    id: 'conf-002',
    recordId: 'rec-002',
    field: '系数偏差',
    calibrationValue: '1.12（校准推算）',
    sensorValue: '1.0（传感器标称）',
    severity: 'medium',
    resolution: 'pending',
    resolvedBy: null,
    resolvedAt: null,
  },
]

const MOCK_CURVES: PumpSpeedCurve[] = [
  {
    recordId: 'rec-001',
    pressure: [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000],
    speed: [150, 148, 145, 140, 135, 120, 100, 60, 30],
    coefficient: 1.0,
    version: 1,
  },
  {
    recordId: 'rec-003',
    pressure: [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000],
    speed: [142, 140, 137, 133, 128, 114, 95, 57, 28],
    coefficient: 0.95,
    version: 2,
  },
  {
    recordId: 'rec-005',
    pressure: [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000],
    speed: [165, 162, 158, 152, 146, 130, 108, 65, 33],
    coefficient: 0.88,
    version: 1,
  },
]

function runSelfCheck(
  records: CalibrationRecord[],
  conflicts: ConflictEvidence[],
): SelfCheckResult[] {
  const now = new Date().toISOString()
  const seen = new Map<string, number>()
  let duplicatePassed = true
  let duplicateDetail = '无重复导入记录'
  records.forEach((r) => {
    const key = `${r.batchNo}-${r.sensorNo}`
    const count = (seen.get(key) || 0) + 1
    seen.set(key, count)
    if (count > 1) {
      duplicatePassed = false
      duplicateDetail = `批次号 ${r.batchNo} + 传感器 ${r.sensorNo} 存在 ${count} 条重复导入`
    }
  })

  const noReasonRecords = records.filter(
    (r) => r.originalCoefficient !== null && !r.coefficientChangeReason,
  )
  const coefficientPassed = noReasonRecords.length === 0
  const coefficientDetail = coefficientPassed
    ? '所有人工修改系数均有原因记录'
    : `${noReasonRecords.map((r) => r.id).join('、')} 人工修改系数但未填写原因`

  const patchedRecords = records.filter(
    (r) => r.originalCoefficient !== null,
  )
  const recalcPassed = patchedRecords.every(
    (r) => Math.abs(r.coefficient - (r.originalCoefficient || r.coefficient) * 1.0) < 0.001 || r.coefficientChangeReason !== null,
  ) || patchedRecords.length === 0
  const recalcDetail = recalcPassed
    ? '补录后重算结果一致'
    : '存在补录后重算结果不一致的记录'

  const hasUnresolvedConflicts = conflicts.some((c) => c.resolution === 'pending')
  const exportPassed = !hasUnresolvedConflicts && coefficientPassed
  const exportDetail = exportPassed
    ? '导出数据与页面/接口一致'
    : hasUnresolvedConflicts
      ? '存在未解决的冲突，导出数据可能不一致'
      : '人工改系数无原因记录可能导致导出不一致'

  return [
    {
      id: 'chk-001',
      checkType: 'duplicate_import',
      passed: duplicatePassed,
      detail: duplicateDetail,
      checkedAt: now,
    },
    {
      id: 'chk-002',
      checkType: 'coefficient_no_reason',
      passed: coefficientPassed,
      detail: coefficientDetail,
      checkedAt: now,
    },
    {
      id: 'chk-003',
      checkType: 'recalc_after_patch',
      passed: recalcPassed,
      detail: recalcDetail,
      checkedAt: now,
    },
    {
      id: 'chk-004',
      checkType: 'export_consistency',
      passed: exportPassed,
      detail: exportDetail,
      checkedAt: now,
    },
  ]
}

interface StoreState {
  records: CalibrationRecord[]
  conflicts: ConflictEvidence[]
  curves: PumpSpeedCurve[]
  selfCheckResults: SelfCheckResult[]
  currentRole: UserRole
  importing: boolean

  setCurrentRole: (role: UserRole) => void
  importRecord: (record: Omit<CalibrationRecord, 'id' | 'importedAt' | 'status' | 'reviewedBy' | 'reviewedAt'>) => { duplicate: boolean; id: string }
  confirmConflict: (conflictId: string) => void
  rejectConflict: (conflictId: string) => void
  updateSensorNote: (recordId: string, note: string) => void
  submitCoefficientReason: (recordId: string, reason: string) => void
  reviewRecord: (recordId: string, approved: boolean, comment: string) => void
  runSelfCheckNow: () => void
  getExportData: () => CalibrationRecord[]
  getApiReturnData: () => CalibrationRecord[]
}

export const useStore = create<StoreState>((set, get) => ({
  records: MOCK_RECORDS,
  conflicts: MOCK_CONFLICTS,
  curves: MOCK_CURVES,
  selfCheckResults: runSelfCheck(MOCK_RECORDS, MOCK_CONFLICTS),
  currentRole: 'inspector',
  importing: false,

  setCurrentRole: (role) => set({ currentRole: role }),

  importRecord: (record) => {
    const duplicate = get().records.some(
      (r) => r.batchNo === record.batchNo && r.sensorNo === record.sensorNo,
    )
    const id = `rec-${String(get().records.length + 1).padStart(3, '0')}`
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const hasCoefficientChange = record.originalCoefficient !== null && record.coefficientChangeReason === null
    const newRecord: CalibrationRecord = {
      ...record,
      id,
      importedAt: now,
      status: hasCoefficientChange ? 'pending_review' : 'normal',
      reviewedBy: null,
      reviewedAt: null,
    }
    set((state) => {
      const newRecords = [...state.records, newRecord]
      const newConflicts = [...state.conflicts]
      if (record.temperatureCalibration !== record.sensorNote) {
        newConflicts.push({
          id: `conf-${String(newConflicts.length + 1).padStart(3, '0')}`,
          recordId: id,
          field: '温度',
          calibrationValue: record.temperatureCalibration,
          sensorValue: record.sensorNote,
          severity: 'high',
          resolution: 'pending',
          resolvedBy: null,
          resolvedAt: null,
        })
        newRecord.status = 'conflict'
      }
      return {
        records: newRecords,
        conflicts: newConflicts,
        selfCheckResults: runSelfCheck(newRecords, newConflicts),
      }
    })
    return { duplicate, id }
  },

  confirmConflict: (conflictId) => {
    set((state) => {
      const newConflicts = state.conflicts.map((c) =>
        c.id === conflictId
          ? {
              ...c,
              resolution: 'confirmed' as const,
              resolvedBy: state.currentRole === 'inspector' ? '质检员小白' : '设备工程师',
              resolvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            }
          : c,
      )
      const conflict = state.conflicts.find((c) => c.id === conflictId)
      const newRecords = conflict
        ? state.records.map((r) =>
            r.id === conflict.recordId && r.status === 'conflict'
              ? { ...r, status: 'normal' as const }
              : r,
          )
        : state.records
      return {
        conflicts: newConflicts,
        records: newRecords,
        selfCheckResults: runSelfCheck(newRecords, newConflicts),
      }
    })
  },

  rejectConflict: (conflictId) => {
    set((state) => {
      const newConflicts = state.conflicts.map((c) =>
        c.id === conflictId
          ? {
              ...c,
              resolution: 'rejected' as const,
              resolvedBy: state.currentRole === 'inspector' ? '质检员小白' : '设备工程师',
              resolvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            }
          : c,
      )
      return {
        conflicts: newConflicts,
        selfCheckResults: runSelfCheck(state.records, newConflicts),
      }
    })
  },

  updateSensorNote: (recordId, note) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? { ...r, sensorNote: note } : r,
      ),
    }))
  },

  submitCoefficientReason: (recordId, reason) => {
    set((state) => {
      const newRecords = state.records.map((r) =>
        r.id === recordId ? { ...r, coefficientChangeReason: reason } : r,
      )
      return {
        records: newRecords,
        selfCheckResults: runSelfCheck(newRecords, state.conflicts),
      }
    })
  },

  reviewRecord: (recordId, approved, comment) => {
    set((state) => {
      const reviewer = state.currentRole === 'engineer' ? '设备工程师' : '质检员小白'
      const newRecords = state.records.map((r) => {
        if (r.id !== recordId) return r
        if (approved) {
          return {
            ...r,
            status: 'reviewed' as const,
            reviewedBy: reviewer,
            reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            coefficientChangeReason: comment || r.coefficientChangeReason,
          }
        }
        return {
          ...r,
          status: 'pending_review' as const,
          coefficientChangeReason: comment || r.coefficientChangeReason,
        }
      })
      return {
        records: newRecords,
        selfCheckResults: runSelfCheck(newRecords, state.conflicts),
      }
    })
  },

  runSelfCheckNow: () => {
    set((state) => ({
      selfCheckResults: runSelfCheck(state.records, state.conflicts),
    }))
  },

  getExportData: () => get().records,
  getApiReturnData: () => get().records,
}))
