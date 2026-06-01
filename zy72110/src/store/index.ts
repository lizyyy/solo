import type { CraneRecord, CalculationResult, ValidationStep, AuditEntry, Supplement, RunHistory, ThresholdConfig } from '@/types'
import { DEFAULT_THRESHOLDS } from '@/types'
import { normalizeAngle, normalizeLength, normalizeVelocity, normalizeTime, swingPeriod, dampingRatio, residualAngle, parameterHash } from '@/utils/physics'
import { validateRecord, determineStatus } from '@/utils/validator'
import { create } from 'zustand'

interface CraneStore {
  records: CraneRecord[]
  validations: ValidationStep[]
  calculations: CalculationResult[]
  auditLog: AuditEntry[]
  supplements: Supplement[]
  runHistories: RunHistory[]
  thresholds: ThresholdConfig

  addRecord: (record: Omit<CraneRecord, 'id' | 'createdAt' | 'status'>) => string
  addSupplement: (recordId: string, note: string) => void
  confirmRecord: (recordId: string) => void
  rerunAll: () => void
  setThresholds: (t: Partial<ThresholdConfig>) => void
  loadSampleData: () => void
  resetAll: () => void
}

let idCounter = 0
function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

function processRecord(record: CraneRecord, existingRecords: CraneRecord[]): {
  steps: ValidationStep[]
  calc: CalculationResult
  audit: AuditEntry
  status: CraneRecord['status']
} {
  const steps = validateRecord(record, existingRecords)
  const status = determineStatus(steps)

  const angleDeg = normalizeAngle(record.swingAngle, record.swingAngleUnit)
  const ropeLengthM = normalizeLength(record.ropeLength, record.ropeLengthUnit)
  const intervalS = normalizeTime(record.sampleInterval, record.sampleIntervalUnit)
  const velocityMs = normalizeVelocity(record.linearVelocity, record.velocityUnit)

  const T = swingPeriod(ropeLengthM)
  const zeta = record.previousSwingAngle
    ? dampingRatio(angleDeg, normalizeAngle(record.previousSwingAngle, record.swingAngleUnit))
    : 0.1
  const thetaRes = residualAngle(angleDeg, zeta, ropeLengthM, record.observationDuration)
  const hash = parameterHash(ropeLengthM, angleDeg, velocityMs, intervalS)

  const calc: CalculationResult = {
    id: uid('calc'),
    recordId: record.id,
    period: T,
    dampingRatio: zeta,
    residualAngle: thetaRes,
    gravity: 9.81,
    computedAt: Date.now(),
    parameterHash: hash,
  }

  const dampingStep: ValidationStep = {
    id: uid('vs'),
    recordId: record.id,
    checkType: 'threshold_damping',
    result: zeta < DEFAULT_THRESHOLDS.minDampingRatio ? 'fail' : 'pass',
    message: zeta < DEFAULT_THRESHOLDS.minDampingRatio
      ? `阻尼比低于 ${DEFAULT_THRESHOLDS.minDampingRatio}(当前ζ=${zeta.toFixed(4)})，摆动抑制不足`
      : `阻尼比正常(ζ=${zeta.toFixed(4)})`,
    timestamp: Date.now(),
  }
  steps.push(dampingStep)

  const audit: AuditEntry = {
    id: uid('audit'),
    recordId: record.id,
    action: status === 'pass' ? '自动通过' : status === 'needs_review' ? '需人工确认' : '标记例外',
    detail: steps.map(s => `[${s.result}] ${s.message}`).join('; '),
    timestamp: Date.now(),
  }

  const finalStatus = determineStatus(steps)
  return { steps, calc, audit, status: finalStatus }
}

const STORAGE_KEY = 'crane-swing-suppression-data'

function loadFromStorage(): Partial<CraneStore> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function saveToStorage(state: Partial<CraneStore>) {
  try {
    const data = {
      records: state.records,
      validations: state.validations,
      calculations: state.calculations,
      auditLog: state.auditLog,
      supplements: state.supplements,
      runHistories: state.runHistories,
      thresholds: state.thresholds,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

const saved = loadFromStorage()

export const useCraneStore = create<CraneStore>((set, get) => ({
  records: saved?.records ?? [],
  validations: saved?.validations ?? [],
  calculations: saved?.calculations ?? [],
  auditLog: saved?.auditLog ?? [],
  supplements: saved?.supplements ?? [],
  runHistories: saved?.runHistories ?? [],
  thresholds: saved?.thresholds ?? DEFAULT_THRESHOLDS,

  addRecord: (input) => {
    const id = uid('rec')
    const record: CraneRecord = { ...input, id, createdAt: Date.now(), status: 'pass' }
    const { steps, calc, audit, status } = processRecord(record, get().records)
    record.status = status

    set(state => {
      const newState = {
        records: [...state.records, record],
        validations: [...state.validations, ...steps],
        calculations: [...state.calculations, calc],
        auditLog: [...state.auditLog, audit],
      }
      saveToStorage({ ...state, ...newState })
      return newState
    })
    return id
  },

  addSupplement: (recordId, note) => {
    const state = get()
    const record = state.records.find(r => r.id === recordId)
    const prevCalc = state.calculations.find(c => c.recordId === recordId)
    if (!record || !prevCalc) return

    const angleDeg = normalizeAngle(record.swingAngle, record.swingAngleUnit)
    const ropeLengthM = normalizeLength(record.ropeLength, record.ropeLengthUnit)
    const T = swingPeriod(ropeLengthM)
    const zeta = prevCalc.dampingRatio
    const newThetaRes = residualAngle(angleDeg, zeta, ropeLengthM, record.observationDuration)
    const delta = newThetaRes - prevCalc.residualAngle

    const deltaExplanation = delta === 0
      ? '补录后残余摆角无变化'
      : delta > 0
        ? `补录后残余摆角增加 ${Math.abs(delta).toFixed(4)}°`
        : `补录后残余摆角减少 ${Math.abs(delta).toFixed(4)}°`

    const supplement: Supplement = {
      id: uid('sup'),
      recordId,
      note,
      addedAt: Date.now(),
      deltaResidualAngle: delta,
      deltaExplanation,
    }

    const audit: AuditEntry = {
      id: uid('audit'),
      recordId,
      action: '补录备注',
      detail: `补录内容: ${note}; ${deltaExplanation}`,
      timestamp: Date.now(),
    }

    set(state => {
      const newState = {
        supplements: [...state.supplements, supplement],
        auditLog: [...state.auditLog, audit],
      }
      saveToStorage({ ...state, ...newState })
      return newState
    })
  },

  confirmRecord: (recordId) => {
    const audit: AuditEntry = {
      id: uid('audit'),
      recordId,
      action: '人工确认通过',
      detail: '教练已确认该记录数据无误',
      timestamp: Date.now(),
    }

    set(state => {
      const newState = {
        records: state.records.map(r =>
          r.id === recordId ? { ...r, status: 'pass' as const } : r
        ),
        auditLog: [...state.auditLog, audit],
      }
      saveToStorage({ ...state, ...newState })
      return newState
    })
  },

  rerunAll: () => {
    const state = get()
    const oldResults = [...state.calculations]
    const newCalcs: CalculationResult[] = []
    const newSteps: ValidationStep[] = []
    const newAudits: AuditEntry[] = []

    const processedRecords: CraneRecord[] = state.records.map(record => {
      const { steps, calc, audit, status } = processRecord(record, state.records)
      newCalcs.push(calc)
      newSteps.push(...steps)
      newAudits.push(audit)
      return { ...record, status }
    })

    const historyEntry: RunHistory = {
      id: uid('run'),
      runAt: Date.now(),
      parameterHash: oldResults.map(r => r.parameterHash).join(','),
      results: oldResults,
      recordIds: state.records.map(r => r.id),
    }

    set(state => {
      const newState = {
        records: processedRecords,
        validations: [...state.validations, ...newSteps],
        calculations: newCalcs,
        auditLog: [...state.auditLog, ...newAudits],
        runHistories: [...state.runHistories, historyEntry],
      }
      saveToStorage({ ...state, ...newState })
      return newState
    })
  },

  setThresholds: (t) => {
    set(state => {
      const newState = {
        thresholds: { ...state.thresholds, ...t },
      }
      saveToStorage({ ...state, ...newState })
      return newState
    })
  },

  loadSampleData: () => {
    const state = get()
    if (state.records.length > 0) return

    const samples: Omit<CraneRecord, 'id' | 'createdAt' | 'status'>[] = [
      {
        source: 'sensor_log',
        rawData: '2024-03-15T08:30:00 | rope=30m | angle=1.8deg | vel=0.3m/s | interval=0.5s | dir=+',
        ropeLength: 30,
        ropeLengthUnit: 'm',
        swingAngle: 1.8,
        swingAngleUnit: 'deg',
        linearVelocity: 0.3,
        velocityUnit: 'm/s',
        timestamp: new Date('2024-03-15T08:30:00').getTime(),
        sampleInterval: 0.5,
        sampleIntervalUnit: 's',
        direction: '+',
        caliberTag: 'current',
        observationDuration: 30,
        previousSwingAngle: 2.1,
      },
      {
        source: 'sensor_log',
        rawData: '2024-03-15T09:15:00 | rope=30m | angle=0.052rad | vel=0.28m/s | interval=0.5s | dir=+',
        ropeLength: 30,
        ropeLengthUnit: 'm',
        swingAngle: 0.052,
        swingAngleUnit: 'rad',
        linearVelocity: 0.28,
        velocityUnit: 'm/s',
        timestamp: new Date('2024-03-15T09:15:00').getTime(),
        sampleInterval: 0.5,
        sampleIntervalUnit: 's',
        direction: '+',
        caliberTag: 'current',
        observationDuration: 30,
        previousSwingAngle: 0.06,
      },
      {
        source: 'sensor_log_legacy',
        rawData: '2023-11-20T14:00:00 | rope=28m | angle=2.1deg | vel=0.35m/s | interval=1.0s | dir=-',
        ropeLength: 28,
        ropeLengthUnit: 'm',
        swingAngle: 2.1,
        swingAngleUnit: 'deg',
        linearVelocity: 0.35,
        velocityUnit: 'm/s',
        timestamp: new Date('2023-11-20T14:00:00').getTime(),
        sampleInterval: 1.0,
        sampleIntervalUnit: 's',
        direction: '-',
        caliberTag: 'legacy_28m',
        observationDuration: 30,
        previousSwingAngle: 2.5,
      },
    ]

    samples.forEach(s => get().addRecord(s))
  },

  resetAll: () => {
    const newState = {
      records: [],
      validations: [],
      calculations: [],
      auditLog: [],
      supplements: [],
      runHistories: [],
      thresholds: DEFAULT_THRESHOLDS,
    }
    set(newState)
    saveToStorage(newState)
  },
}))
