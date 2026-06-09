import { create } from 'zustand'

export interface SamplingList {
  id: string
  name: string
  fingerprint: string
  recordCount: number
  importTime: string
  status: 'active' | 'archived'
  lastBatchId?: string
  lastImportTime?: string
  lastBatchTime?: string
  hasDuplicateImport?: boolean
  importCount?: number
  duplicateImportCount?: number
  importHistory?: Array<{ time: string; operator?: string; batchId?: string }>
  batches?: any[]
}

export interface SamplingRecord {
  id: string
  listId: string
  originalValue: number
  isNegative: boolean
  oldTableStatus: 'normal' | 'missing' | 'anomaly'
  isBoundary: boolean
  boundaryStatus: 'pending' | 'confirmed' | 'ignored'
  remark: string
  batchId?: string
  traceableId?: string
  remarkHistory?: Array<{ time: string; operator: string; operatorRole: string; oldValue: string; newValue: string }>
}

export interface ParamEntry {
  id: string
  key: string
  value: number
  description: string
  updatedAt: string
  updatedBy: string
}

export interface ParamChangeRecord {
  id: string
  paramId: string
  field: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
  changeType: 'value' | 'remark' | 'boundary_rule'
}

export interface CostAllocationResult {
  id: string
  recordId: string
  allocatedCost: number
  isBoundary: boolean
  boundaryType?: string
  sourceListId: string
  sourceParamId?: string
  originalValue?: number
  listName?: string
  listId?: string
  boundaryStatus?: string
  traceableId?: string
  batchId?: string
  correctedValue?: number
  processReason?: string
  confirmedBy?: string
  sourceParamKey?: string
  sourceParamValue?: number
  unitCost?: number
  allocationRatio?: number
}

export interface CalculationSummary {
  totalSamples: number
  totalCost: number
  boundaryCount: number
  pendingCount: number
  confirmedCount: number
  ignoredCount: number
  batchCount: number
  needReviewCount: number
}

export interface BoundarySample {
  id: string
  recordId: string
  type: string
  status: 'pending' | 'confirmed' | 'ignored'
  description: string
  detectedAt: string
  confirmedBy?: string
  confirmedAt?: string
  originalValue?: number
  isNegative?: number
  oldTableStatus?: string
  remark?: string
  listName?: string
  listId?: string
  reviewComments: ReviewComment[]
  correctedValue?: number
  processReason?: string
  decisionDetail?: string
  reviewCommentsCount?: number
  batchId?: string
  traceableId?: string
}

export interface ReviewComment {
  id: string
  boundaryId: string
  author: string
  authorRole: string
  content: string
  createdAt: string
}

export interface ChangeLogEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  field?: string
  oldValue?: string
  newValue?: string
  operator: string
  operatorRole: string
  timestamp: string
  canRollback: boolean
  humanReadable?: string
  affectedEntities?: Array<{ table: string; id: string }>
  rollbackPreview?: Array<{ field: string; willBecome: string; currentValue: string }>
}

export type UserRole = '教研负责人' | '学生助教' | '数据录入员'

export interface RollbackResult {
  rollbackDetails?: {
    tables: string[]
    fields: Array<{ table: string; field: string; from: string; to: string }>
  }
}

function mapList(raw: any): SamplingList {
  const dupCount = raw.duplicateImportCount ?? raw.import_count ?? raw.importCount ?? raw.importCount
  return {
    id: raw.id,
    name: raw.name,
    fingerprint: raw.fingerprint,
    recordCount: raw.record_count ?? raw.recordCount ?? 0,
    importTime: raw.import_time ?? raw.importTime ?? '',
    status: raw.status,
    lastBatchId: raw.lastBatchId ?? raw.last_batch_id,
    lastImportTime: raw.lastImportTime ?? raw.last_import_time,
    lastBatchTime: raw.lastBatchTime ?? raw.last_import_time ?? raw.lastImportTime ?? raw.import_time ?? raw.importTime,
    hasDuplicateImport: !!raw.hasDuplicateImport,
    importCount: raw.importCount ?? raw.import_count,
    duplicateImportCount: dupCount,
    importHistory: raw.importHistory,
    batches: raw.batches,
  }
}

function mapRecord(raw: any): SamplingRecord {
  return {
    id: raw.id,
    listId: raw.list_id ?? raw.listId ?? '',
    originalValue: raw.original_value ?? raw.originalValue ?? 0,
    isNegative: !!(raw.is_negative ?? raw.isNegative),
    oldTableStatus: raw.old_table_status ?? raw.oldTableStatus ?? 'normal',
    isBoundary: !!(raw.is_boundary ?? raw.isBoundary),
    boundaryStatus: raw.boundary_status ?? raw.boundaryStatus ?? 'pending',
    remark: raw.remark ?? '',
    batchId: raw.batch_id ?? raw.batchId,
    traceableId: raw.traceable_id ?? raw.traceableId ?? raw.id,
    remarkHistory: (raw.remarkHistory ?? raw.remark_history ?? []).map((h: any) => ({
      time: h.time ?? h.changed_at ?? h.changedAt ?? '',
      operator: h.operator ?? h.changed_by ?? h.changedBy ?? '',
      operatorRole: h.operatorRole ?? h.operator_role ?? '',
      oldValue: h.oldValue ?? h.old_remark ?? h.oldRemark ?? '',
      newValue: h.newValue ?? h.new_remark ?? h.newRemark ?? '',
    })),
  }
}

function mapParam(raw: any): ParamEntry {
  return {
    id: raw.id,
    key: raw.key,
    value: raw.value,
    description: raw.description,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
    updatedBy: raw.updated_by ?? raw.updatedBy ?? '',
  }
}

function mapParamChange(raw: any): ParamChangeRecord {
  return {
    id: raw.id,
    paramId: raw.param_id ?? raw.paramId ?? '',
    field: raw.field,
    oldValue: raw.old_value ?? raw.oldValue ?? '',
    newValue: raw.new_value ?? raw.newValue ?? '',
    changedBy: raw.changed_by ?? raw.changedBy ?? '',
    changedAt: raw.changed_at ?? raw.changedAt ?? '',
    changeType: raw.change_type ?? raw.changeType ?? 'value',
  }
}

function mapCalcResult(raw: any): CostAllocationResult {
  return {
    id: raw.id,
    recordId: raw.record_id ?? raw.recordId ?? '',
    allocatedCost: raw.allocated_cost ?? raw.allocatedCost ?? 0,
    isBoundary: !!(raw.is_boundary ?? raw.isBoundary),
    boundaryType: raw.boundary_type ?? raw.boundaryType,
    sourceListId: raw.source_list_id ?? raw.sourceListId ?? '',
    sourceParamId: raw.source_param_id ?? raw.sourceParamId,
    originalValue: raw.original_value ?? raw.originalValue,
    listName: raw.list_name ?? raw.listName,
    listId: raw.list_id ?? raw.listId,
    boundaryStatus: raw.boundary_status ?? raw.boundaryStatus,
    traceableId: raw.traceable_id ?? raw.traceableId ?? raw.record_id ?? raw.recordId,
    batchId: raw.batch_id ?? raw.batchId,
    correctedValue: raw.corrected_value ?? raw.correctedValue,
    processReason: raw.process_reason ?? raw.processReason,
    confirmedBy: raw.confirmed_by ?? raw.confirmedBy,
    sourceParamKey: raw.source_param_key ?? raw.sourceParamKey,
    sourceParamValue: raw.source_param_value ?? raw.sourceParamValue,
    unitCost: raw.unitCost ?? raw.unit_cost,
    allocationRatio: raw.allocationRatio ?? raw.allocation_ratio,
  }
}

function mapBoundarySample(raw: any): BoundarySample {
  return {
    id: raw.id,
    recordId: raw.record_id ?? raw.recordId ?? '',
    type: raw.type,
    status: raw.status,
    description: raw.description,
    detectedAt: raw.detected_at ?? raw.detectedAt ?? '',
    confirmedBy: raw.confirmed_by ?? raw.confirmedBy,
    confirmedAt: raw.confirmed_at ?? raw.confirmedAt,
    originalValue: raw.original_value ?? raw.originalValue,
    isNegative: raw.is_negative ?? raw.isNegative,
    oldTableStatus: raw.old_table_status ?? raw.oldTableStatus,
    remark: raw.remark,
    listName: raw.list_name ?? raw.listName,
    listId: raw.listId ?? raw.list_id,
    reviewComments: [],
    correctedValue: raw.corrected_value ?? raw.correctedValue,
    processReason: raw.process_reason ?? raw.processReason,
    decisionDetail: raw.decision_detail ?? raw.decisionDetail,
    reviewCommentsCount: raw.review_comments_count ?? raw.reviewCommentsCount,
    batchId: raw.batch_id ?? raw.batchId,
    traceableId: raw.traceable_id ?? raw.traceableId ?? raw.record_id ?? raw.recordId,
  }
}

function mapChangeLog(raw: any): ChangeLogEntry {
  return {
    id: raw.id,
    entityType: raw.entity_type ?? raw.entityType ?? '',
    entityId: raw.entity_id ?? raw.entityId ?? '',
    action: raw.action,
    field: raw.field,
    oldValue: raw.old_value ?? raw.oldValue,
    newValue: raw.new_value ?? raw.newValue,
    operator: raw.operator,
    operatorRole: raw.operator_role ?? raw.operatorRole ?? '',
    timestamp: raw.timestamp,
    canRollback: !!(raw.can_rollback ?? raw.canRollback ?? true),
    humanReadable: raw.humanReadable,
    affectedEntities: raw.affectedEntities,
    rollbackPreview: raw.rollbackPreview,
  }
}

interface AppState {
  samplingLists: SamplingList[]
  samplingRecords: SamplingRecord[]
  currentList: SamplingList | null
  relatedParams: ParamEntry[]

  params: ParamEntry[]
  paramChanges: ParamChangeRecord[]

  calculationResults: CostAllocationResult[]
  calculationSummary: CalculationSummary | null
  selectedResult: CostAllocationResult | null

  boundarySamples: BoundarySample[]
  currentBoundary: BoundarySample | null

  changeLog: ChangeLogEntry[]
  changeLogTotal: number
  currentChangeLogDetail: ChangeLogEntry | null

  sidebarOpen: boolean
  viewMode: '3d' | 'chart'
  userRole: UserRole
  loading: Record<string, boolean>
  error: Record<string, string | null>

  fetchSamplingLists: () => Promise<void>
  importSamplingList: (file: File, listName: string) => Promise<{
    importedCount: number
    boundaryCount: number
    message?: string
    batchId?: string
    duplicateImportCount?: number
    originalListId?: string
    historyBatches?: any[]
  }>
  fetchSamplingDetail: (id: string) => Promise<void>
  updateRecordRemark: (recordId: string, remark: string, operator?: string, operatorRole?: string) => Promise<void>
  exportSampling: (listId?: string) => void

  fetchParams: () => Promise<void>
  updateParam: (id: string, data: { value?: number; description?: string }) => Promise<{ oldValue?: number; newValue?: number; key?: string }>
  fetchParamHistory: () => Promise<void>

  fetchCalculation: () => Promise<void>
  setSelectedResult: (result: CostAllocationResult | null) => void
  exportCalculation: () => void

  fetchBoundarySamples: (status?: string) => Promise<void>
  updateBoundaryStatus: (
    id: string,
    status: 'confirmed' | 'ignored',
    options?: {
      comment?: string
      processReason?: string
      decisionDetail?: string
      correctedValue?: number
    }
  ) => Promise<void>
  addReviewComment: (boundaryId: string, content: string) => Promise<void>
  exportBoundary: () => void

  fetchChangeLog: (filters?: { entityType?: string; action?: string; page?: number }) => Promise<void>
  getChangeLogDetail: (id: string) => Promise<ChangeLogEntry>
  rollbackChange: (id: string) => Promise<RollbackResult>

  setSidebarOpen: (open: boolean) => void
  setViewMode: (mode: '3d' | 'chart') => void
  setUserRole: (role: UserRole) => void
}

export const useStore = create<AppState>((set, get) => ({
  samplingLists: [],
  samplingRecords: [],
  currentList: null,
  relatedParams: [],

  params: [],
  paramChanges: [],

  calculationResults: [],
  calculationSummary: null,
  selectedResult: null,

  boundarySamples: [],
  currentBoundary: null,

  changeLog: [],
  changeLogTotal: 0,
  currentChangeLogDetail: null,

  sidebarOpen: true,
  viewMode: '3d',
  userRole: '教研负责人',
  loading: {},
  error: {},

  fetchSamplingLists: async () => {
    set(s => ({ loading: { ...s.loading, samplingLists: true }, error: { ...s.error, samplingLists: null } }))
    try {
      const res = await fetch('/api/sampling')
      const json = await res.json()
      const rawItems: any[] = json.data?.items ?? json.data ?? []
      const lists = rawItems.map(mapList)
      set({ samplingLists: lists, loading: { ...get().loading, samplingLists: false } })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, samplingLists: false }, error: { ...s.error, samplingLists: e.message } }))
    }
  },

  importSamplingList: async (file, listName) => {
    set(s => ({ loading: { ...s.loading, importSampling: true }, error: { ...s.error, importSampling: null } }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', listName)
      formData.append('operator', get().userRole)
      formData.append('operatorRole', get().userRole)
      const res = await fetch('/api/sampling/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || '导入失败')
      }
      await get().fetchSamplingLists()
      set(s => ({ loading: { ...s.loading, importSampling: false } }))
      const d = json.data ?? {}
      if (d.skipped) {
        return {
          importedCount: 0,
          boundaryCount: 0,
          message: json.message || '这份抽样名单已经导入过了，不会重复计算数量',
          batchId: d.batchId,
          duplicateImportCount: d.duplicateImportCount,
          originalListId: d.originalListId,
          historyBatches: d.historyBatches,
        }
      }
      return {
        importedCount: d.recordCount ?? 0,
        boundaryCount: d.boundaryCount ?? 0,
        batchId: d.batchId,
        duplicateImportCount: d.duplicateImportCount,
        originalListId: d.originalListId,
        historyBatches: d.historyBatches,
      }
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, importSampling: false }, error: { ...s.error, importSampling: e.message } }))
      throw e
    }
  },

  fetchSamplingDetail: async (id) => {
    set(s => ({ loading: { ...s.loading, samplingDetail: true }, error: { ...s.error, samplingDetail: null } }))
    try {
      const res = await fetch(`/api/sampling/${id}`)
      const json = await res.json()
      const d = json.data ?? json
      set({
        currentList: mapList(d.list ?? {}),
        samplingRecords: (d.records ?? []).map(mapRecord),
        relatedParams: (d.params ?? []).map(mapParam),
        loading: { ...get().loading, samplingDetail: false },
      })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, samplingDetail: false }, error: { ...s.error, samplingDetail: e.message } }))
    }
  },

  updateRecordRemark: async (recordId, remark, operator, operatorRole) => {
    set(s => ({ loading: { ...s.loading, updateRecordRemark: true }, error: { ...s.error, updateRecordRemark: null } }))
    try {
      const res = await fetch(`/api/sampling/records/${recordId}/remark`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remark,
          operator: operator ?? get().userRole,
          operatorRole: operatorRole ?? get().userRole,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || '修改备注失败')
      }
      set(s => ({
        samplingRecords: s.samplingRecords.map(r => r.id === recordId ? { ...r, remark } : r),
        loading: { ...s.loading, updateRecordRemark: false },
      }))
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, updateRecordRemark: false }, error: { ...s.error, updateRecordRemark: e.message } }))
      throw e
    }
  },

  exportSampling: (listId) => {
    if (!listId) {
      const firstList = get().samplingLists[0]
      if (!firstList) return
      listId = firstList.id
    }
    window.open(`/api/sampling/export/csv?listId=${encodeURIComponent(listId)}`, '_blank')
  },

  fetchParams: async () => {
    set(s => ({ loading: { ...s.loading, params: true }, error: { ...s.error, params: null } }))
    try {
      const res = await fetch('/api/params')
      const json = await res.json()
      const rawItems: any[] = json.data ?? json.params ?? []
      set({ params: rawItems.map(mapParam), loading: { ...get().loading, params: false } })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, params: false }, error: { ...s.error, params: e.message } }))
    }
  },

  updateParam: async (id, data) => {
    set(s => ({ loading: { ...s.loading, updateParam: true }, error: { ...s.error, updateParam: null } }))
    try {
      const old = get().params.find(p => p.id === id)
      const oldValue = old?.value
      const key = old?.key
      const res = await fetch(`/api/params/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, changedBy: get().userRole, operatorRole: get().userRole }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || '保存失败')
      }
      await get().fetchParams()
      set(s => ({ loading: { ...s.loading, updateParam: false } }))
      return { oldValue, newValue: data.value, key }
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, updateParam: false }, error: { ...s.error, updateParam: e.message } }))
      throw e
    }
  },

  fetchParamHistory: async () => {
    set(s => ({ loading: { ...s.loading, paramHistory: true }, error: { ...s.error, paramHistory: null } }))
    try {
      const res = await fetch('/api/params/history')
      const json = await res.json()
      const rawItems: any[] = json.data?.items ?? json.data ?? json.changes ?? []
      set({ paramChanges: rawItems.map(mapParamChange), loading: { ...get().loading, paramHistory: false } })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, paramHistory: false }, error: { ...s.error, paramHistory: e.message } }))
    }
  },

  fetchCalculation: async () => {
    set(s => ({ loading: { ...s.loading, calculation: true }, error: { ...s.error, calculation: null } }))
    try {
      const res = await fetch('/api/calculation')
      const json = await res.json()
      const d = json.data ?? json
      set({
        calculationResults: (d.results ?? []).map(mapCalcResult),
        calculationSummary: d.summary ?? null,
        loading: { ...get().loading, calculation: false },
      })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, calculation: false }, error: { ...s.error, calculation: e.message } }))
    }
  },

  setSelectedResult: (result) => set({ selectedResult: result }),

  exportCalculation: () => {
    window.open('/api/calculation/export', '_blank')
  },

  fetchBoundarySamples: async (status) => {
    set(s => ({ loading: { ...s.loading, boundary: true }, error: { ...s.error, boundary: null } }))
    try {
      const url = status ? `/api/boundary?status=${status}` : '/api/boundary'
      const res = await fetch(url)
      const json = await res.json()
      const rawItems: any[] = json.data ?? json.samples ?? []
      set({ boundarySamples: rawItems.map(mapBoundarySample), loading: { ...get().loading, boundary: false } })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, boundary: false }, error: { ...s.error, boundary: e.message } }))
    }
  },

  updateBoundaryStatus: async (id, status, options = {}) => {
    set(s => ({ loading: { ...s.loading, updateBoundary: true }, error: { ...s.error, updateBoundary: null } }))
    try {
      const res = await fetch(`/api/boundary/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          comment: options.comment,
          processReason: options.processReason,
          decisionDetail: options.decisionDetail,
          correctedValue: options.correctedValue,
          confirmedBy: get().userRole,
          operatorRole: get().userRole,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || '操作失败')
      }
      await get().fetchBoundarySamples()
      set(s => ({ loading: { ...s.loading, updateBoundary: false } }))
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, updateBoundary: false }, error: { ...s.error, updateBoundary: e.message } }))
      throw e
    }
  },

  addReviewComment: async (boundaryId, content) => {
    try {
      const res = await fetch(`/api/boundary/${boundaryId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, author: get().userRole, authorRole: get().userRole }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || '添加审核意见失败')
      }
      await get().fetchBoundarySamples()
    } catch (e: any) {
      set(s => ({ error: { ...s.error, addReview: e.message } }))
    }
  },

  exportBoundary: () => {
    window.open('/api/boundary/export', '_blank')
  },

  fetchChangeLog: async (filters) => {
    set(s => ({ loading: { ...s.loading, changeLog: true }, error: { ...s.error, changeLog: null } }))
    try {
      const params = new URLSearchParams()
      if (filters?.entityType) params.set('entityType', filters.entityType)
      if (filters?.action) params.set('action', filters.action)
      if (filters?.page) params.set('page', String(filters.page))
      const qs = params.toString()
      const res = await fetch(`/api/history${qs ? `?${qs}` : ''}`)
      const json = await res.json()
      const d = json.data ?? json
      set({
        changeLog: (d.items ?? d.entries ?? []).map(mapChangeLog),
        changeLogTotal: d.total ?? 0,
        loading: { ...get().loading, changeLog: false },
      })
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, changeLog: false }, error: { ...s.error, changeLog: e.message } }))
    }
  },

  getChangeLogDetail: async (id) => {
    const res = await fetch(`/api/history/${id}`)
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || '获取变更详情失败')
    }
    const entry = mapChangeLog(json.data.entry)
    set({ currentChangeLogDetail: entry })
    return entry
  },

  rollbackChange: async (id) => {
    set(s => ({ loading: { ...s.loading, rollback: true }, error: { ...s.error, rollback: null } }))
    try {
      const res = await fetch(`/api/history/${id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: get().userRole, operatorRole: get().userRole }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || '回滚失败')
      }
      await get().fetchChangeLog()
      set(s => ({ loading: { ...s.loading, rollback: false } }))
      return { rollbackDetails: json.rollbackDetails } as RollbackResult
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, rollback: false }, error: { ...s.error, rollback: e.message } }))
      throw e
    }
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setUserRole: (role) => set({ userRole: role }),
}))
