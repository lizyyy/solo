import { create } from 'zustand'
import type {
  CalibrationRecord,
  ConflictEvidence,
  SelfCheckResult,
  PumpSpeedCurve,
  UserRole,
  AuditEntry,
  ImportBatch,
} from '@/types'

const NOW = () => new Date().toISOString().replace('T', ' ').slice(0, 19)
const ROLE_NAME = (r: UserRole) => r === 'inspector' ? '质检员小白' : '设备工程师'

const INITIAL_BATCHES: ImportBatch[] = [
  { id: 'BATCH-HIST-001', importedBy: '系统初始化', importedAt: '2024-03-12 09:15:00', source: 'file', recordCount: 3 },
  { id: 'BATCH-HIST-002', importedBy: '系统初始化', importedAt: '2024-03-15 14:20:00', source: 'file', recordCount: 1 },
  { id: 'BATCH-HIST-003', importedBy: '系统初始化', importedAt: '2024-03-18 10:30:00', source: 'patch', recordCount: 1 },
  { id: 'BATCH-HIST-004', importedBy: '系统初始化', importedAt: '2024-03-20 16:45:00', source: 'file', recordCount: 1 },
]

const INITIAL_RECORDS: CalibrationRecord[] = [
  {
    id: 'rec-001',
    traceId: 'VAC-2024-0312-0001',
    importBatchId: 'BATCH-HIST-001',
    batchNo: 'BATCH-2024-0312',
    temperatureCalibration: '25.0°C',
    sensorNo: 'SN-8801',
    sensorNote: '传感器编号SN-8801现场校准温度25.0°C',
    mainMaterial: '316L不锈钢（主材料，同温度校准记录一致）',
    coefficient: 1.0,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'normal',
    nextHandler: null,
    nextHandlerNote: null,
    importedAt: '2024-03-12 09:15:00',
    updatedAt: '2024-03-12 09:15:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-002',
    traceId: 'VAC-2024-0315-0002',
    importBatchId: 'BATCH-HIST-002',
    batchNo: 'BATCH-2024-0315',
    temperatureCalibration: '22.5°C',
    sensorNo: 'SN-8802',
    sensorNote: '传感器编号SN-8802实际记录温度28.0°C（关键备注：现场温度传感器漂移）',
    mainMaterial: '304不锈钢',
    coefficient: 1.12,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'conflict',
    nextHandler: 'inspector',
    nextHandlerNote: '温度校准值 22.5°C 与传感器备注 28.0°C 矛盾，请质检员确认',
    importedAt: '2024-03-15 14:20:00',
    updatedAt: '2024-03-15 14:20:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-003',
    traceId: 'VAC-2024-0318-0003',
    importBatchId: 'BATCH-HIST-003',
    batchNo: 'BATCH-2024-0318',
    temperatureCalibration: '23.0°C',
    sensorNo: 'SN-8803',
    sensorNote: '传感器编号SN-8803校准温度23.0°C',
    mainMaterial: '碳钢Q235',
    coefficient: 0.95,
    originalCoefficient: 1.0,
    coefficientChangeReason: null,
    status: 'pending_review',
    nextHandler: 'engineer',
    nextHandlerNote: '系数从 1.0 修改为 0.95 但未填写原因，请设备工程师复核',
    importedAt: '2024-03-18 10:30:00',
    updatedAt: '2024-03-18 10:30:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-004',
    traceId: 'VAC-2024-0312-0001-DUP',
    importBatchId: 'BATCH-HIST-004',
    batchNo: 'BATCH-2024-0312',
    temperatureCalibration: '25.0°C',
    sensorNo: 'SN-8801',
    sensorNote: '传感器编号SN-8801现场校准温度25.0°C',
    mainMaterial: '316L不锈钢',
    coefficient: 1.0,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'normal',
    nextHandler: null,
    nextHandlerNote: null,
    importedAt: '2024-03-12 09:15:00',
    updatedAt: '2024-03-20 16:45:00',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'rec-005',
    traceId: 'VAC-2024-0320-0005',
    importBatchId: 'BATCH-HIST-004',
    batchNo: 'BATCH-2024-0320',
    temperatureCalibration: '24.0°C',
    sensorNo: 'SN-8805',
    sensorNote: '传感器编号SN-8805记录温度24.0°C',
    mainMaterial: '铝合金6061',
    coefficient: 0.88,
    originalCoefficient: null,
    coefficientChangeReason: null,
    status: 'normal',
    nextHandler: null,
    nextHandlerNote: null,
    importedAt: '2024-03-20 16:45:00',
    updatedAt: '2024-03-20 16:45:00',
    reviewedBy: null,
    reviewedAt: null,
  },
]

const INITIAL_CONFLICTS: ConflictEvidence[] = [
  {
    id: 'conf-001',
    recordId: 'rec-002',
    field: '温度',
    calibrationValue: '22.5°C',
    sensorValue: '传感器编号SN-8802实际记录温度28.0°C（关键备注：现场温度传感器漂移）',
    severity: 'high',
    resolution: 'pending',
    resolvedBy: null,
    resolvedByName: null,
    resolvedAt: null,
    resolutionReason: null,
  },
  {
    id: 'conf-002',
    recordId: 'rec-002',
    field: '系数偏差',
    calibrationValue: '1.12（按校准温度 22.5°C 推算）',
    sensorValue: '1.0（按传感器编号 SN-8802 标称值推算）',
    severity: 'medium',
    resolution: 'pending',
    resolvedBy: null,
    resolvedByName: null,
    resolvedAt: null,
    resolutionReason: null,
  },
]

const PRESSURE_SCALE = [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000]
const BASE_SPEED_MAP: Record<string, number[]> = {
  'rec-001': [150, 148, 145, 140, 135, 120, 100, 60, 30],
  'rec-003': [150, 148, 145, 140, 135, 120, 100, 60, 30],
  'rec-005': [165, 162, 158, 152, 146, 130, 108, 65, 33],
}

function applyCoefficient(base: number[], c: number): number[] {
  return base.map((v) => Math.round(v * c * 100) / 100)
}

const INITIAL_CURVES: PumpSpeedCurve[] = (['rec-001', 'rec-003', 'rec-005'] as const).map((id) => {
  const r = INITIAL_RECORDS.find((x) => x.id === id)!
  const base = BASE_SPEED_MAP[id]
  return {
    recordId: id,
    pressure: PRESSURE_SCALE,
    baseSpeed: base,
    speed: applyCoefficient(base, r.coefficient),
    coefficient: r.coefficient,
    version: id === 'rec-003' ? 2 : 1,
    calculationDetail: `抽速 = 基准抽速 × 系数 ${r.coefficient}（基准来自标准曲线 ${versionToBase(id)}；版本 v${id === 'rec-003' ? 2 : 1}）`,
  }
})

function versionToBase(id: string) {
  if (id === 'rec-001') return 'BASE-ST-316L'
  if (id === 'rec-003') return 'BASE-CS-Q235'
  return 'BASE-AL-6061'
}

const INITIAL_AUDIT: AuditEntry[] = [
  {
    id: 'aud-001', recordId: 'rec-001',
    changedBy: 'system', changedByName: '系统初始化', changedAt: '2024-03-12 09:15:00',
    field: 'record', oldValue: null, newValue: '创建记录', reason: '首次导入温度校准记录', action: 'import',
  },
  {
    id: 'aud-002', recordId: 'rec-002',
    changedBy: 'system', changedByName: '系统初始化', changedAt: '2024-03-15 14:20:00',
    field: 'record', oldValue: null, newValue: '创建记录', reason: '首次导入，检测到温度校准与传感器备注矛盾', action: 'import',
  },
  {
    id: 'aud-003', recordId: 'rec-003',
    changedBy: 'system', changedByName: '系统初始化', changedAt: '2024-03-18 10:30:00',
    field: 'coefficient', oldValue: 1.0, newValue: 0.95, reason: '补录修正系数，但未填写原因', action: 'update',
  },
  {
    id: 'aud-004', recordId: 'rec-004',
    changedBy: 'system', changedByName: '系统初始化', changedAt: '2024-03-20 16:45:00',
    field: 'record', oldValue: null, newValue: '重复导入 rec-001', reason: '历史批次 BATCH-HIST-004 与 BATCH-HIST-001 重复', action: 'import',
  },
  {
    id: 'aud-005', recordId: 'rec-005',
    changedBy: 'system', changedByName: '系统初始化', changedAt: '2024-03-20 16:45:00',
    field: 'record', oldValue: null, newValue: '创建记录', reason: '首次导入温度校准记录', action: 'import',
  },
]

function runSelfCheck(
  records: CalibrationRecord[],
  conflicts: ConflictEvidence[],
  audits: AuditEntry[],
): SelfCheckResult[] {
  const now = NOW()
  const affected: Record<string, string[]> = {}

  const dupMap = new Map<string, CalibrationRecord[]>()
  records.forEach((r) => {
    const k = `${r.batchNo}-${r.sensorNo}`
    dupMap.set(k, [...(dupMap.get(k) || []), r])
  })
  const dupEntries = [...dupMap.entries()].filter(([, list]) => list.length > 1)
  const dupPassed = dupEntries.length === 0
  affected.duplicate_import = dupEntries.flatMap(([, list]) => list.map((r) => r.id))

  const noReasonRecords = records.filter(
    (r) => r.originalCoefficient !== null && !r.coefficientChangeReason,
  )
  const coeffPassed = noReasonRecords.length === 0
  affected.coefficient_no_reason = noReasonRecords.map((r) => r.id)

  const patched = records.filter((r) => r.originalCoefficient !== null)
  const recalcFailed = patched.filter((r) => {
    const baseSpeed = BASE_SPEED_MAP[r.id]
    if (!baseSpeed) return false
    const expected = applyCoefficient(baseSpeed, r.coefficient)
    return !r.coefficientChangeReason && Math.abs(r.coefficient - r.originalCoefficient!) > 0.0001
  })
  const recalcPassed = recalcFailed.length === 0
  affected.recalc_after_patch = recalcFailed.map((r) => r.id)

  const unresolvedConflicts = conflicts.filter((c) => c.resolution === 'pending')
  const exportPassed = unresolvedConflicts.length === 0 && coeffPassed
  affected.export_consistency = [
    ...unresolvedConflicts.map((c) => c.recordId),
    ...noReasonRecords.map((r) => r.id),
  ]

  const historyCheck = records.filter((r) => {
    const rAudits = audits.filter((a) => a.recordId === r.id)
    if (r.originalCoefficient !== null) {
      return rAudits.some((a) => a.field === 'coefficient')
    }
    return true
  })
  const historyFailed = records.filter((r) => !historyCheck.includes(r))
  affected.history_sync = historyFailed.map((r) => r.id)

  const tracePassed = records.every((r) => r.traceId && r.importBatchId)
  affected.trace_consistency = records.filter((r) => !r.traceId || !r.importBatchId).map((r) => r.id)

  const buildDetail = (passed: boolean, yes: string, noFn: () => string) => passed ? yes : noFn()

  return [
    {
      id: 'chk-001',
      checkType: 'duplicate_import',
      passed: dupPassed,
      detail: buildDetail(
        dupPassed,
        '无重复导入记录',
        () => `重复组合：${dupEntries.map(([k, list]) => `${k} × ${list.length}（导入批次 ${list.map((l) => l.importBatchId).join('/')}）`).join('； ')}`,
      ),
      affectedRecordIds: affected.duplicate_import,
      checkedAt: now,
    },
    {
      id: 'chk-002',
      checkType: 'coefficient_no_reason',
      passed: coeffPassed,
      detail: buildDetail(
        coeffPassed,
        '所有人工修改系数均有原因记录',
        () => `缺少原因：${noReasonRecords.map((r) => `${r.id}（${r.originalCoefficient}→${r.coefficient}）`).join('、 ')}`,
      ),
      affectedRecordIds: affected.coefficient_no_reason,
      checkedAt: now,
    },
    {
      id: 'chk-003',
      checkType: 'recalc_after_patch',
      passed: recalcPassed,
      detail: buildDetail(
        recalcPassed,
        '补录后重算结果与曲线同步',
        () => `重算未同步：${recalcFailed.map((r) => r.id).join('、 ')}`,
      ),
      affectedRecordIds: affected.recalc_after_patch,
      checkedAt: now,
    },
    {
      id: 'chk-004',
      checkType: 'export_consistency',
      passed: exportPassed,
      detail: buildDetail(
        exportPassed,
        '导出 / 页面 / 接口三者从同一份 store 读取，完全一致',
        () => `未一致项：${unresolvedConflicts.length ? `未解决冲突 ${unresolvedConflicts.length} 条` : ''}${!coeffPassed ? `；人工改系数无原因 ${noReasonRecords.length} 条` : ''}`,
      ),
      affectedRecordIds: Array.from(new Set(affected.export_consistency)),
      checkedAt: now,
    },
    {
      id: 'chk-005',
      checkType: 'history_sync',
      passed: historyFailed.length === 0,
      detail: buildDetail(
        historyFailed.length === 0,
        '所有变更均有对应审计日志',
        () => `历史缺失：${historyFailed.map((r) => r.id).join('、 ')}`,
      ),
      affectedRecordIds: affected.history_sync,
      checkedAt: now,
    },
    {
      id: 'chk-006',
      checkType: 'trace_consistency',
      passed: tracePassed,
      detail: buildDetail(
        tracePassed,
        '每条记录都有 traceId + importBatchId，可反查',
        () => `主键缺失：${affected.trace_consistency.join('、 ')}`,
      ),
      affectedRecordIds: affected.trace_consistency,
      checkedAt: now,
    },
  ]
}

type ImportDraft = {
  batchNo: string
  temperatureCalibration: string
  sensorNo: string
  sensorNote: string
  mainMaterial: string
  coefficient: number
  originalCoefficient: number | null
}

interface StoreState {
  records: CalibrationRecord[]
  conflicts: ConflictEvidence[]
  curves: PumpSpeedCurve[]
  audits: AuditEntry[]
  batches: ImportBatch[]
  selfCheckResults: SelfCheckResult[]
  currentRole: UserRole
  activeImportBatchId: string | null

  setCurrentRole: (role: UserRole) => void
  newActiveBatch: () => string
  importRecord: (draft: ImportDraft, batchId?: string) => { duplicate: boolean; id: string; isNewBatch: boolean }
  confirmConflict: (conflictId: string, reason?: string) => void
  rejectConflict: (conflictId: string, reason?: string) => void
  patchSensorNote: (recordId: string, note: string, reason?: string) => void
  patchCoefficient: (recordId: string, newCoefficient: number, reason: string | null) => void
  submitCoefficientReason: (recordId: string, reason: string) => void
  reviewRecord: (recordId: string, approved: boolean, comment: string) => void
  recalcCurvesForRecord: (recordId: string) => void
  runSelfCheckNow: () => void
  getExportData: () => (CalibrationRecord & { traceId: string; importBatchId: string; audits: AuditEntry[] })[]
  getApiReturnData: () => (CalibrationRecord & { traceId: string; importBatchId: string; audits: AuditEntry[] })[]
  getReportData: () => (CalibrationRecord & { traceId: string; importBatchId: string; audits: AuditEntry[]; curve: PumpSpeedCurve | undefined })[]
}

function addAudit(
  audits: AuditEntry[],
  e: Omit<AuditEntry, 'id' | 'changedAt'>,
): AuditEntry[] {
  return [
    ...audits,
    { ...e, id: `aud-${String(audits.length + 1).padStart(3, '0')}`, changedAt: NOW() },
  ]
}

function determineNextHandler(r: CalibrationRecord): CalibrationRecord['nextHandler'] {
  if (r.status === 'conflict') return 'inspector'
  if (r.status === 'pending_review') return 'engineer'
  return null
}

export const useStore = create<StoreState>((set, get) => ({
  records: INITIAL_RECORDS,
  conflicts: INITIAL_CONFLICTS,
  curves: INITIAL_CURVES,
  audits: INITIAL_AUDIT,
  batches: INITIAL_BATCHES,
  selfCheckResults: runSelfCheck(INITIAL_RECORDS, INITIAL_CONFLICTS, INITIAL_AUDIT),
  currentRole: 'inspector',
  activeImportBatchId: null,

  setCurrentRole: (role) => set({ currentRole: role }),

  newActiveBatch: () => {
    const id = `BATCH-CUR-${String(get().batches.length + 1).padStart(3, '0')}`
    set((s) => ({
      activeImportBatchId: id,
      batches: [
        ...s.batches,
        {
          id,
          importedBy: ROLE_NAME(s.currentRole),
          importedAt: NOW(),
          source: 'manual',
          recordCount: 0,
        },
      ],
    }))
    return id
  },

  importRecord: (draft, batchId) => {
    const state = get()
    const currentBatchId = batchId || state.activeImportBatchId || state.newActiveBatch()
    const isNewBatch = !state.batches.some((b) => b.id === currentBatchId)

    const existingSame = state.records.filter(
      (r) => r.batchNo === draft.batchNo && r.sensorNo === draft.sensorNo,
    )
    const duplicate = existingSame.length > 0

    const id = `rec-${String(state.records.length + 1).padStart(3, '0')}`
    const traceId = `VAC-${draft.batchNo.replace(/\D/g, '').slice(0, 8)}-${id.slice(-4)}`

    const hasCoeffChange = draft.originalCoefficient !== null && draft.originalCoefficient !== draft.coefficient
    const rawStatus: CalibrationRecord['status'] = hasCoeffChange
      ? 'pending_review'
      : 'normal'
    let finalStatus = rawStatus

    const tempMismatch = draft.temperatureCalibration && draft.sensorNote
      && !draft.sensorNote.includes(draft.temperatureCalibration.replace('°C', ''))

    let newAudits = state.audits
    let newConflicts = [...state.conflicts]

    const newRecord: CalibrationRecord = {
      id,
      traceId,
      importBatchId: currentBatchId,
      batchNo: draft.batchNo,
      temperatureCalibration: draft.temperatureCalibration,
      sensorNo: draft.sensorNo,
      sensorNote: draft.sensorNote || `传感器编号${draft.sensorNo}${draft.temperatureCalibration ? `，温度${draft.temperatureCalibration}` : ''}`,
      mainMaterial: draft.mainMaterial,
      coefficient: draft.coefficient,
      originalCoefficient: draft.originalCoefficient,
      coefficientChangeReason: null,
      status: finalStatus,
      nextHandler: determineNextHandler({ ...{ id: '' }, status: finalStatus } as CalibrationRecord),
      nextHandlerNote: null,
      importedAt: NOW(),
      updatedAt: NOW(),
      reviewedBy: null,
      reviewedAt: null,
    }

    newAudits = addAudit(newAudits, {
      recordId: id,
      changedBy: state.currentRole,
      changedByName: ROLE_NAME(state.currentRole),
      field: 'record',
      oldValue: null,
      newValue: JSON.stringify(draft),
      reason: duplicate ? `本次导入（批次 ${currentBatchId}）与历史批次 ${existingSame.map((r) => r.importBatchId).join('/')} 重复组合 ${draft.batchNo}-${draft.sensorNo}` : `本次导入（批次 ${currentBatchId}）首次入库`,
      action: 'import',
    })

    if (tempMismatch) {
      newConflicts.push({
        id: `conf-${String(newConflicts.length + 1).padStart(3, '0')}`,
        recordId: id,
        field: '温度',
        calibrationValue: draft.temperatureCalibration,
        sensorValue: newRecord.sensorNote,
        severity: 'high',
        resolution: 'pending',
        resolvedBy: null,
        resolvedByName: null,
        resolvedAt: null,
        resolutionReason: null,
      })
      newRecord.status = 'conflict'
      newRecord.nextHandler = 'inspector'
      newRecord.nextHandlerNote = '温度校准值与传感器备注矛盾，请质检员确认或驳回'
    }

    if (hasCoeffChange) {
      newRecord.nextHandler = 'engineer'
      newRecord.nextHandlerNote = '系数已人工修改但未填写原因，请设备工程师复核'
      newAudits = addAudit(newAudits, {
        recordId: id,
        changedBy: state.currentRole,
        changedByName: ROLE_NAME(state.currentRole),
        field: 'coefficient',
        oldValue: draft.originalCoefficient,
        newValue: draft.coefficient,
        reason: null,
        action: 'update',
      })
    }

    const newRecords = [...state.records, newRecord]

    const newCurves = [...state.curves]
    const existingBase = existingSame[0] && state.curves.find((c) => c.recordId === existingSame[0].id)
    const base = existingBase ? existingBase.baseSpeed : existingSame[0]?.originalCoefficient
      ? BASE_SPEED_MAP[existingSame[0].id] || BASE_SPEED_MAP['rec-001']
      : BASE_SPEED_MAP['rec-001']
    newCurves.push({
      recordId: id,
      pressure: PRESSURE_SCALE,
      baseSpeed: base,
      speed: applyCoefficient(base, newRecord.coefficient),
      coefficient: newRecord.coefficient,
      version: duplicate ? (existingBase?.version || 1) + 1 : 1,
      calculationDetail: `抽速 = 基准抽速 × 系数 ${newRecord.coefficient}（基准：${existingBase ? `来自同批次 ${existingSame[0]?.batchNo}` : '默认 BASE-ST'}; 版本 v${duplicate ? (existingBase?.version || 1) + 1 : 1}）`,
    })

    const newBatches = isNewBatch
      ? [...state.batches, {
          id: currentBatchId,
          importedBy: ROLE_NAME(state.currentRole),
          importedAt: NOW(),
          source: 'manual' as const,
          recordCount: 1,
        }]
      : state.batches.map((b) =>
          b.id === currentBatchId ? { ...b, recordCount: b.recordCount + 1 } : b,
        )

    set({
      records: newRecords,
      conflicts: newConflicts,
      curves: newCurves,
      audits: newAudits,
      batches: newBatches,
      activeImportBatchId: currentBatchId,
      selfCheckResults: runSelfCheck(newRecords, newConflicts, newAudits),
    })

    return { duplicate, id, isNewBatch }
  },

  confirmConflict: (conflictId, reason) => {
    set((state) => {
      const conflict = state.conflicts.find((c) => c.id === conflictId)
      if (!conflict) return state
      let newRecords = state.records.map((r) =>
        r.id === conflict.recordId && r.status === 'conflict'
          ? {
              ...r,
              status: (r.originalCoefficient !== null && !r.coefficientChangeReason)
                ? 'pending_review' as const
                : 'normal' as const,
              updatedAt: NOW(),
              nextHandler: (r.originalCoefficient !== null && !r.coefficientChangeReason)
                ? 'engineer' as const
                : null,
              nextHandlerNote: (r.originalCoefficient !== null && !r.coefficientChangeReason)
                ? '系数修改无原因，转设备工程师复核'
                : null,
            }
          : r,
      )
      const newConflicts = state.conflicts.map((c) =>
        c.id === conflictId
          ? {
              ...c,
              resolution: 'confirmed' as const,
              resolvedBy: ROLE_NAME(state.currentRole),
              resolvedByName: state.currentRole,
              resolvedAt: NOW(),
              resolutionReason: reason || '质检员按温度校准记录确认，保留当前值',
            }
          : c,
      )
      let newAudits = addAudit(state.audits, {
        recordId: conflict.recordId,
        changedBy: state.currentRole,
        changedByName: ROLE_NAME(state.currentRole),
        field: conflict.field,
        oldValue: conflict.sensorValue,
        newValue: conflict.calibrationValue,
        reason: reason || `确认冲突：以校准值 ${conflict.calibrationValue} 为准`,
        action: 'confirm',
      })
      newRecords.forEach((r) => {
        if (r.id === conflict.recordId) {
          state.curves.forEach((c) => {
            if (c.recordId === r.id) {
              get().recalcCurvesForRecord(r.id)
            }
          })
        }
      })
      return {
        records: newRecords,
        conflicts: newConflicts,
        audits: newAudits,
        selfCheckResults: runSelfCheck(newRecords, newConflicts, newAudits),
      }
    })
  },

  rejectConflict: (conflictId, reason) => {
    set((state) => {
      const conflict = state.conflicts.find((c) => c.id === conflictId)
      if (!conflict) return state
      const newConflicts = state.conflicts.map((c) =>
        c.id === conflictId
          ? {
              ...c,
              resolution: 'rejected' as const,
              resolvedBy: ROLE_NAME(state.currentRole),
              resolvedByName: state.currentRole,
              resolvedAt: NOW(),
              resolutionReason: reason || '质检员驳回，数据有疑问需重测',
            }
          : c,
      )
      const newAudits = addAudit(state.audits, {
        recordId: conflict.recordId,
        changedBy: state.currentRole,
        changedByName: ROLE_NAME(state.currentRole),
        field: conflict.field,
        oldValue: conflict.calibrationValue,
        newValue: conflict.sensorValue,
        reason: reason || `驳回冲突：返回重测，以传感器备注 ${conflict.sensorValue} 暂存`,
        action: 'reject',
      })
      return {
        conflicts: newConflicts,
        audits: newAudits,
        selfCheckResults: runSelfCheck(state.records, newConflicts, newAudits),
      }
    })
  },

  patchSensorNote: (recordId, note, reason) => {
    set((state) => {
      const target = state.records.find((r) => r.id === recordId)
      if (!target) return state
      const newRecords = state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              sensorNote: note,
              updatedAt: NOW(),
            }
          : r,
      )
      let newConflicts = state.conflicts
      const existingTempConflict = state.conflicts.find(
        (c) => c.recordId === recordId && c.field === '温度' && c.resolution === 'pending',
      )
      if (existingTempConflict && note.includes(target.temperatureCalibration.replace('°C', ''))) {
        newConflicts = state.conflicts.map((c) =>
          c.id === existingTempConflict.id
            ? {
                ...c,
                sensorValue: note,
                resolution: 'confirmed' as const,
                resolvedBy: '系统自动（备注补录后一致）',
                resolvedByName: state.currentRole,
                resolvedAt: NOW(),
                resolutionReason: '补录传感器备注后与温度校准一致',
              }
            : c,
        )
        newRecords.forEach((r) => {
          if (r.id === recordId && r.status === 'conflict') {
            r.status = (r.originalCoefficient !== null && !r.coefficientChangeReason)
              ? 'pending_review'
              : 'normal'
            r.nextHandler = (r.originalCoefficient !== null && !r.coefficientChangeReason)
              ? 'engineer'
              : null
          }
        })
      }
      const newAudits = addAudit(state.audits, {
        recordId,
        changedBy: state.currentRole,
        changedByName: ROLE_NAME(state.currentRole),
        field: 'sensorNote',
        oldValue: target.sensorNote,
        newValue: note,
        reason: reason || '补录传感器编号备注（包含关键备注说明）',
        action: 'update',
      })
      return {
        records: newRecords,
        conflicts: newConflicts,
        audits: newAudits,
        selfCheckResults: runSelfCheck(newRecords, newConflicts, newAudits),
      }
    })
  },

  patchCoefficient: (recordId, newCoefficient, reason) => {
    set((state) => {
      const target = state.records.find((r) => r.id === recordId)
      if (!target) return state
      const old = target.coefficient
      const newRecords = state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              originalCoefficient: r.originalCoefficient ?? old,
              coefficient: newCoefficient,
              coefficientChangeReason: reason || r.coefficientChangeReason,
              status: reason ? r.status : ('pending_review' as const),
              nextHandler: reason ? r.nextHandler : ('engineer' as const),
              nextHandlerNote: reason ? r.nextHandlerNote : '系数已人工修改，补录原因后请设备工程师复核',
              updatedAt: NOW(),
            }
          : r,
      )
      let newAudits = addAudit(state.audits, {
        recordId,
        changedBy: state.currentRole,
        changedByName: ROLE_NAME(state.currentRole),
        field: 'coefficient',
        oldValue: old,
        newValue: newCoefficient,
        reason: reason || null,
        action: 'update',
      })
      const newCurves = state.curves.map((c) => {
        if (c.recordId !== recordId) return c
        return {
          ...c,
          coefficient: newCoefficient,
          speed: applyCoefficient(c.baseSpeed, newCoefficient),
          version: c.version + 1,
          calculationDetail: `系数变更重算：抽速 = 基准抽速 × 系数 ${newCoefficient}（原系数 ${old}，变更原因：${reason || '未填写'}；版本 v${c.version + 1}）`,
        }
      })
      return {
        records: newRecords,
        curves: newCurves,
        audits: newAudits,
        selfCheckResults: runSelfCheck(newRecords, state.conflicts, newAudits),
      }
    })
  },

  submitCoefficientReason: (recordId, reason) => {
    set((state) => {
      const target = state.records.find((r) => r.id === recordId)
      if (!target) return state
      const newRecords = state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              coefficientChangeReason: reason,
              updatedAt: NOW(),
            }
          : r,
      )
      const newAudits = addAudit(state.audits, {
        recordId,
        changedBy: state.currentRole,
        changedByName: ROLE_NAME(state.currentRole),
        field: 'coefficientChangeReason',
        oldValue: null,
        newValue: reason,
        reason: `补充原因：${reason}`,
        action: 'update',
      })
      return {
        records: newRecords,
        audits: newAudits,
        selfCheckResults: runSelfCheck(newRecords, state.conflicts, newAudits),
      }
    })
  },

  reviewRecord: (recordId, approved, comment) => {
    set((state) => {
      const target = state.records.find((r) => r.id === recordId)
      if (!target) return state
      const reviewer = state.currentRole
      const newRecords = state.records.map((r) => {
        if (r.id !== recordId) return r
        if (approved) {
          return {
            ...r,
            status: 'reviewed' as const,
            reviewedBy: ROLE_NAME(reviewer),
            reviewedAt: NOW(),
            coefficientChangeReason: comment || r.coefficientChangeReason,
            nextHandler: null,
            nextHandlerNote: null,
            updatedAt: NOW(),
          }
        }
        return {
          ...r,
          status: 'pending_review' as const,
          coefficientChangeReason: comment || r.coefficientChangeReason,
          nextHandler: 'inspector' as const,
          nextHandlerNote: `设备工程师驳回：${comment || '补充更详细的修改原因'}`,
          updatedAt: NOW(),
        }
      })
      let newAudits = addAudit(state.audits, {
        recordId,
        changedBy: reviewer,
        changedByName: ROLE_NAME(reviewer),
        field: 'status',
        oldValue: target.status,
        newValue: approved ? 'reviewed' : 'pending_review',
        reason: comment || (approved ? '复核通过' : '复核驳回，退回补原因'),
        action: approved ? 'review_approve' : 'review_reject',
      })
      const newCurves = approved
        ? state.curves.map((c) => {
            if (c.recordId !== recordId) return c
            const r = newRecords.find((x) => x.id === recordId)!
            return {
              ...c,
              calculationDetail: `已复核：抽速 = 基准抽速 × 系数 ${r.coefficient}（复核人：${ROLE_NAME(reviewer)}，复核意见：${comment || '通过'}; 版本 v${c.version}）`,
            }
          })
        : state.curves
      return {
        records: newRecords,
        curves: newCurves,
        audits: newAudits,
        selfCheckResults: runSelfCheck(newRecords, state.conflicts, newAudits),
      }
    })
  },

  recalcCurvesForRecord: (recordId) => {
    set((state) => {
      const r = state.records.find((x) => x.id === recordId)
      if (!r) return state
      const newCurves = state.curves.map((c) => {
        if (c.recordId !== recordId) return c
        return {
          ...c,
          coefficient: r.coefficient,
          speed: applyCoefficient(c.baseSpeed, r.coefficient),
          version: c.version + 1,
          calculationDetail: `状态变更触发重算：抽速 = 基准抽速 × 系数 ${r.coefficient}；版本 v${c.version + 1}`,
        }
      })
      return { curves: newCurves }
    })
  },

  runSelfCheckNow: () => {
    set((state) => ({
      selfCheckResults: runSelfCheck(state.records, state.conflicts, state.audits),
    }))
  },

  getExportData: () => {
    const s = get()
    return s.records.map((r) => ({
      ...r,
      traceId: r.traceId,
      importBatchId: r.importBatchId,
      audits: s.audits.filter((a) => a.recordId === r.id),
    }))
  },

  getApiReturnData: () => {
    const s = get()
    return s.records.map((r) => ({
      ...r,
      traceId: r.traceId,
      importBatchId: r.importBatchId,
      audits: s.audits.filter((a) => a.recordId === r.id),
    }))
  },

  getReportData: () => {
    const s = get()
    return s.records.map((r) => ({
      ...r,
      traceId: r.traceId,
      importBatchId: r.importBatchId,
      audits: s.audits.filter((a) => a.recordId === r.id),
      curve: s.curves.find((c) => c.recordId === r.id),
    }))
  },
}))
