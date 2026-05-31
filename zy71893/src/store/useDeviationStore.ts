import { create } from 'zustand'
import type {
  DeviationRecord,
  StatusTransition,
  Correction,
  Review,
  RecordStatus,
  DeviationType,
  RecordSource,
} from '@/types'
import { ABNORMAL_TYPES } from '@/types'
import { MOCK_RECORDS, MOCK_TRANSITIONS, MOCK_CORRECTIONS, MOCK_REVIEWS } from '@/data/mock'

interface FilterState {
  status: RecordStatus | ''
  deviationType: DeviationType | ''
  source: RecordSource | ''
  dateFrom: string
  dateTo: string
  keyword: string
  responsiblePerson: string
}

interface DeviationStore {
  records: DeviationRecord[]
  transitions: StatusTransition[]
  corrections: Correction[]
  reviews: Review[]
  filters: FilterState
  selectedIds: string[]
  currentUser: string

  setFilter: (key: keyof FilterState, value: string) => void
  resetFilters: () => void
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void

  addRecord: (record: Omit<DeviationRecord, 'id' | 'createdAt' | 'status'>) => DeviationRecord
  importRecords: (records: Omit<DeviationRecord, 'id' | 'createdAt' | 'status'>[]) => { imported: number; duplicates: number; duplicateList: string[] }
  correctRecord: (recordId: string, field: string, oldValue: string, newValue: string, reason: string) => void
  revokeCorrection: (correctionId: string) => void
  transitionStatus: (recordId: string, toStatus: RecordStatus, reason: string) => void
  addReview: (recordId: string, result: 'pass' | 'questioned', reason: string) => void

  getRecordById: (id: string) => DeviationRecord | undefined
  getTransitionsForRecord: (recordId: string) => StatusTransition[]
  getCorrectionsForRecord: (recordId: string) => Correction[]
  getReviewsForRecord: (recordId: string) => Review[]
  getFilteredRecords: () => DeviationRecord[]
  getStats: () => { total: number; pendingConfirmation: number; pendingProcessing: number; confirmed: number; closed: number }
  exportFilteredRecords: () => string

  canTransitionTo: (recordId: string, toStatus: RecordStatus) => boolean
}

const initialFilters: FilterState = {
  status: '',
  deviationType: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  keyword: '',
  responsiblePerson: '',
}

let nextId = 100
function genId(prefix: string) {
  nextId += 1
  return `${prefix}-${String(nextId).padStart(3, '0')}`
}

function determineInitialStatus(deviationType: DeviationType): RecordStatus {
  if ((ABNORMAL_TYPES as string[]).includes(deviationType)) {
    return 'pending_confirmation'
  }
  return 'pending_processing'
}

function getStatusTransitionReason(deviationType: DeviationType): string {
  switch (deviationType) {
    case 'threshold_crossing':
      return '阈值跨档类型自动标记为待确认'
    case 'fault_sequence_error':
      return '故障复现顺序错类型自动标记为待确认'
    case 'alarm_duplicate_confirm':
      return '报警重复确认类型自动标记为待确认'
    default:
      return '普通偏差自动标记为待处理'
  }
}

export const useDeviationStore = create<DeviationStore>((set, get) => ({
  records: [...MOCK_RECORDS],
  transitions: [...MOCK_TRANSITIONS],
  corrections: [...MOCK_CORRECTIONS],
  reviews: [...MOCK_REVIEWS],
  filters: { ...initialFilters },
  selectedIds: [],
  currentUser: '张建国',

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...initialFilters } }),

  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((i) => i !== id)
        : [...state.selectedIds, id],
    })),

  selectAll: (ids) => set({ selectedIds: ids }),

  clearSelection: () => set({ selectedIds: [] }),

  addRecord: (partial) => {
    const status = determineInitialStatus(partial.deviationType)
    const record: DeviationRecord = {
      ...partial,
      id: genId('rec'),
      status,
      createdAt: new Date().toISOString(),
    }
    const transition: StatusTransition = {
      id: genId('tr'),
      recordId: record.id,
      fromStatus: null,
      toStatus: status,
      operator: '系统',
      reason: getStatusTransitionReason(partial.deviationType),
      operatedAt: record.createdAt,
    }
    set((state) => ({
      records: [...state.records, record],
      transitions: [...state.transitions, transition],
    }))
    return record
  },

  importRecords: (partials) => {
    const state = get()
    const existingKeys = new Set(
      state.records.map((r) => `${r.code}|${r.deviationType}|${r.discoveredAt}`)
    )
    const newRecords: DeviationRecord[] = []
    const duplicateList: string[] = []
    const newTransitions: StatusTransition[] = []

    for (const partial of partials) {
      const key = `${partial.code}|${partial.deviationType}|${partial.discoveredAt}`
      if (existingKeys.has(key) || newRecords.some((r) => `${r.code}|${r.deviationType}|${r.discoveredAt}` === key)) {
        duplicateList.push(partial.code)
        continue
      }
      const status = determineInitialStatus(partial.deviationType)
      const record: DeviationRecord = {
        ...partial,
        id: genId('rec'),
        status,
        createdAt: new Date().toISOString(),
        source: 'csv_import',
      }
      const transition: StatusTransition = {
        id: genId('tr'),
        recordId: record.id,
        fromStatus: null,
        toStatus: status,
        operator: '系统',
        reason: getStatusTransitionReason(partial.deviationType),
        operatedAt: record.createdAt,
      }
      newRecords.push(record)
      newTransitions.push(transition)
    }

    set((state) => ({
      records: [...state.records, ...newRecords],
      transitions: [...state.transitions, ...newTransitions],
    }))

    return {
      imported: newRecords.length,
      duplicates: duplicateList.length,
      duplicateList,
    }
  },

  correctRecord: (recordId, field, oldValue, newValue, reason) => {
    const correction: Correction = {
      id: genId('cor'),
      recordId,
      field,
      oldValue,
      newValue,
      operator: get().currentUser,
      reason,
      isRevoked: false,
      correctedAt: new Date().toISOString(),
    }
    set((state) => {
      const record = state.records.find((r) => r.id === recordId)
      if (!record) return state
      const updatedRecords = state.records.map((r) =>
        r.id === recordId
          ? { ...r, [field]: newValue, status: 'pending_processing' as RecordStatus }
          : r
      )
      const transition: StatusTransition = {
        id: genId('tr'),
        recordId,
        fromStatus: record.status,
        toStatus: 'pending_processing',
        operator: state.currentUser,
        reason: `修正字段「${field}」，原因：${reason}`,
        operatedAt: new Date().toISOString(),
      }
      return {
        records: updatedRecords,
        corrections: [...state.corrections, correction],
        transitions: [...state.transitions, transition],
      }
    })
  },

  revokeCorrection: (correctionId) => {
    set((state) => {
      const correction = state.corrections.find((c) => c.id === correctionId)
      if (!correction || correction.isRevoked) return state

      const record = state.records.find((r) => r.id === correction.recordId)
      if (!record) return state

      const updatedRecords = state.records.map((r) =>
        r.id === correction.recordId
          ? { ...r, [correction.field]: correction.oldValue }
          : r
      )
      const updatedCorrections = state.corrections.map((c) =>
        c.id === correctionId ? { ...c, isRevoked: true } : c
      )
      const transition: StatusTransition = {
        id: genId('tr'),
        recordId: correction.recordId,
        fromStatus: record.status,
        toStatus: 'pending_processing',
        operator: state.currentUser,
        reason: `撤回对「${correction.field}」的修正，恢复原值`,
        operatedAt: new Date().toISOString(),
      }
      return {
        records: updatedRecords,
        corrections: updatedCorrections,
        transitions: [...state.transitions, transition],
      }
    })
  },

  transitionStatus: (recordId, toStatus, reason) => {
    set((state) => {
      const record = state.records.find((r) => r.id === recordId)
      if (!record) return state

      if (toStatus === 'confirmed' && (ABNORMAL_TYPES as string[]).includes(record.deviationType)) {
        const hasReview = state.reviews.some(
          (r) => r.recordId === recordId && r.result === 'pass'
        )
        if (!hasReview) return state
      }

      const updatedRecords = state.records.map((r) =>
        r.id === recordId ? { ...r, status: toStatus } : r
      )
      const transition: StatusTransition = {
        id: genId('tr'),
        recordId,
        fromStatus: record.status,
        toStatus,
        operator: state.currentUser,
        reason,
        operatedAt: new Date().toISOString(),
      }
      return {
        records: updatedRecords,
        transitions: [...state.transitions, transition],
      }
    })
  },

  addReview: (recordId, result, reason) => {
    const review: Review = {
      id: genId('rv'),
      recordId,
      reviewer: get().currentUser,
      result,
      reason,
      reviewedAt: new Date().toISOString(),
    }
    set((state) => ({
      reviews: [...state.reviews, review],
    }))
  },

  getRecordById: (id) => get().records.find((r) => r.id === id),

  getTransitionsForRecord: (recordId) =>
    get().transitions.filter((t) => t.recordId === recordId).sort((a, b) => new Date(a.operatedAt).getTime() - new Date(b.operatedAt).getTime()),

  getCorrectionsForRecord: (recordId) =>
    get().corrections.filter((c) => c.recordId === recordId).sort((a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime()),

  getReviewsForRecord: (recordId) =>
    get().reviews.filter((r) => r.recordId === recordId).sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()),

  getFilteredRecords: () => {
    const { records, filters } = get()
    return records.filter((r) => {
      if (filters.status && r.status !== filters.status) return false
      if (filters.deviationType && r.deviationType !== filters.deviationType) return false
      if (filters.source && r.source !== filters.source) return false
      if (filters.dateFrom && r.discoveredAt < filters.dateFrom) return false
      if (filters.dateTo && r.discoveredAt > filters.dateTo + 'T23:59:59') return false
      if (filters.responsiblePerson && r.createdBy !== filters.responsiblePerson) return false
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase()
        return (
          r.code.toLowerCase().includes(kw) ||
          r.description.toLowerCase().includes(kw) ||
          r.equipmentCode.toLowerCase().includes(kw)
        )
      }
      return true
    })
  },

  getStats: () => {
    const records = get().records
    return {
      total: records.length,
      pendingConfirmation: records.filter((r) => r.status === 'pending_confirmation').length,
      pendingProcessing: records.filter((r) => r.status === 'pending_processing').length,
      confirmed: records.filter((r) => r.status === 'confirmed').length,
      closed: records.filter((r) => r.status === 'closed').length,
    }
  },

  exportFilteredRecords: () => {
    const state = get()
    const filtered = state.getFilteredRecords()
    const header = '记录编号,偏差类型,来源,设备编号,当前状态,发现时间,创建人,偏差描述'
    const rows = filtered.map((r) => {
      const corrections = state.getCorrectionsForRecord(r.id)
      const correctionInfo = corrections.length > 0
        ? ` [修正${corrections.length}次]`
        : ''
      return `${r.code},${r.deviationType},${r.source},${r.equipmentCode},${r.status},${r.discoveredAt},${r.createdBy},"${r.description}${correctionInfo}"`
    })
    return [header, ...rows].join('\n')
  },

  canTransitionTo: (recordId, toStatus) => {
    const state = get()
    const record = state.records.find((r) => r.id === recordId)
    if (!record) return false

    if (toStatus === 'confirmed' && (ABNORMAL_TYPES as string[]).includes(record.deviationType)) {
      const hasPassReview = state.reviews.some(
        (r) => r.recordId === recordId && r.result === 'pass'
      )
      return hasPassReview
    }
    return true
  },
}))
