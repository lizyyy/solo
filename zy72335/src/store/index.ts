import { create } from 'zustand'

export interface BoundarySpec {
  id: string
  rawRowId: string
  fieldName: string
  minValue: number | null
  maxValue: number | null
  unit: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CalculationDetail {
  id: string
  rawRowId: string
  kept: boolean
  keepReason: string
  missingMaterials: string[]
  nextAction: 'contact_activity_leader' | 'contact_coach' | 'no_action'
  mixedFormatFlagged: boolean
  reviewStatus: 'pending' | 'confirmed' | 'rejected'
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  rawRow?: RawRow
}

export interface RawRow {
  id: string
  uniqueKey: string
  content: string
  percentageValue: string | null
  decimalValue: string | null
  hasMixedFormat: boolean
  boundaryId: string | null
  importBatchId: string
  createdAt: string
  updatedAt: string
  boundary?: BoundarySpec
  calculation?: CalculationDetail
}

export interface ChangeRecord {
  id: string
  entityType: 'raw_row' | 'boundary' | 'calculation'
  entityId: string
  fieldName: string
  oldValue: string
  newValue: string
  reason: string
  changedBy: string
  affectedResults: string[]
  createdAt: string
}

export interface ImportLog {
  id: string
  batchId: string
  operator: string
  totalRows: number
  newRows: number
  skippedRows: number
  conflictRows: number
  createdAt: string
}

export interface WorkflowStatus {
  rawRowImported: boolean
  rawRowImportedAt: string | null
  boundaryReviewed: boolean
  boundaryReviewedAt: string | null
  calculationUpdated: boolean
  calculationUpdatedAt: string | null
}

export interface ReportItem {
  id: string
  content: string
}

export interface KeptItem extends ReportItem {
  keepReason: string
  boundary?: { fieldName: string; minValue: number | null; maxValue: number | null; unit: string } | null
}

export interface FlaggedItem extends ReportItem {
  percentageValue: string | null
  decimalValue: string | null
  reviewStatus: string
}

export interface MissingMaterialItem extends ReportItem {
  missingMaterials: string[]
}

export interface NextActionItem extends ReportItem {
  nextAction: string
}

export interface ReportSections {
  keptItems: KeptItem[]
  flaggedItems: FlaggedItem[]
  missingMaterials: MissingMaterialItem[]
  nextActions: NextActionItem[]
}

export interface Report {
  id: string
  title: string
  createdAt: string
  generatedAt: string
  summary: {
    totalRows: number
    keptCount: number
    flaggedCount: number
    missingCount: number
    actionRequiredCount: number
  }
  sections: ReportSections
}

export interface ImportResult {
  batchId: string
  newRows: number
  skippedRows: number
  totalRows: number
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API request failed')
  return json.data as T
}

interface AppState {
  currentOperator: string
  setCurrentOperator: (op: string) => void

  workflowStatus: WorkflowStatus | null
  fetchWorkflowStatus: () => Promise<void>
  advanceWorkflow: (step: string) => Promise<void>

  rawRows: RawRow[]
  fetchRawRows: (filters?: { mixedFormat?: boolean; hasBoundary?: boolean }) => Promise<void>
  getRawRow: (id: string) => Promise<RawRow>
  importRawRows: (rows: Array<{ uniqueKey: string; content: string; percentageValue?: string; decimalValue?: string }>, operator: string) => Promise<ImportResult>
  updateRawRow: (id: string, updates: Partial<{ content: string; percentageValue: string; decimalValue: string; reason: string }>) => Promise<void>
  deleteRawRow: (id: string) => Promise<void>

  boundarySpecs: BoundarySpec[]
  fetchBoundarySpecs: (filters?: { rawRowId?: string }) => Promise<void>
  createBoundarySpec: (spec: Omit<BoundarySpec, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BoundarySpec>
  updateBoundarySpec: (id: string, updates: Partial<BoundarySpec>, reason?: string) => Promise<void>

  calculationDetails: CalculationDetail[]
  fetchCalculations: (filters?: { reviewStatus?: string; mixedFormatFlagged?: boolean }) => Promise<void>
  reviewCalculation: (id: string, reviewStatus: 'confirmed' | 'rejected', reviewedBy: string) => Promise<void>
  refreshCalculations: () => Promise<void>

  changeRecords: ChangeRecord[]
  fetchChangeRecords: (filters?: { entityType?: string; entityId?: string }) => Promise<void>

  importLogs: ImportLog[]
  fetchImportLogs: () => Promise<void>

  reports: Report[]
  fetchReports: () => Promise<void>
  generateReport: () => Promise<Report>
  getReport: (id: string) => Promise<Report>
}

export const useAppStore = create<AppState>((set, get) => ({
  currentOperator: '竞赛教练 唐老师',
  setCurrentOperator: (op) => set({ currentOperator: op }),

  workflowStatus: null,
  fetchWorkflowStatus: async () => {
    try {
      const data = await apiFetch<WorkflowStatus>('/api/workflow/status')
      set({ workflowStatus: data })
    } catch {
      set({ workflowStatus: null })
    }
  },
  advanceWorkflow: async (step: string) => {
    const data = await apiFetch<WorkflowStatus>('/api/workflow/advance', {
      method: 'POST',
      body: JSON.stringify({ step }),
    })
    set({ workflowStatus: data })
  },

  rawRows: [],
  fetchRawRows: async (filters?: { mixedFormat?: boolean; hasBoundary?: boolean }) => {
    try {
      const params = new URLSearchParams()
      if (filters?.mixedFormat !== undefined) params.set('mixedFormat', String(filters.mixedFormat))
      if (filters?.hasBoundary !== undefined) params.set('hasBoundary', String(filters.hasBoundary))
      const query = params.toString()
      const url = `/api/raw-rows${query ? `?${query}` : ''}`
      const data = await apiFetch<RawRow[]>(url)
      set({ rawRows: data })
    } catch {
      set({ rawRows: [] })
    }
  },
  getRawRow: async (id: string) => {
    return await apiFetch<RawRow>(`/api/raw-rows/${id}`)
  },
  importRawRows: async (rows, operator) => {
    const result = await apiFetch<ImportResult>('/api/raw-rows/import', {
      method: 'POST',
      body: JSON.stringify({ rows, operator }),
    })
    await get().fetchRawRows()
    await get().fetchImportLogs()
    await get().fetchWorkflowStatus()
    return result
  },
  updateRawRow: async (id, updates) => {
    await apiFetch(`/api/raw-rows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    await get().fetchRawRows()
    await get().fetchChangeRecords({ entityId: id })
  },
  deleteRawRow: async (id) => {
    await apiFetch(`/api/raw-rows/${id}`, {
      method: 'DELETE',
    })
    await get().fetchRawRows()
  },

  boundarySpecs: [],
  fetchBoundarySpecs: async (filters?: { rawRowId?: string }) => {
    try {
      const params = new URLSearchParams()
      if (filters?.rawRowId) params.set('rawRowId', filters.rawRowId)
      const query = params.toString()
      const url = `/api/boundaries${query ? `?${query}` : ''}`
      const data = await apiFetch<BoundarySpec[]>(url)
      set({ boundarySpecs: data })
    } catch {
      set({ boundarySpecs: [] })
    }
  },
  createBoundarySpec: async (spec) => {
    const result = await apiFetch<BoundarySpec>('/api/boundaries', {
      method: 'POST',
      body: JSON.stringify(spec),
    })
    await get().fetchBoundarySpecs()
    await get().fetchRawRows()
    return result
  },
  updateBoundarySpec: async (id, updates, reason) => {
    await apiFetch(`/api/boundaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, reason }),
    })
    await get().fetchBoundarySpecs()
    await get().fetchRawRows()
    await get().fetchChangeRecords({ entityId: id })
  },

  calculationDetails: [],
  fetchCalculations: async (filters?: { reviewStatus?: string; mixedFormatFlagged?: boolean }) => {
    try {
      const params = new URLSearchParams()
      if (filters?.reviewStatus) params.set('reviewStatus', filters.reviewStatus)
      if (filters?.mixedFormatFlagged) params.set('mixedFormatFlagged', 'true')
      const query = params.toString()
      const url = `/api/calculations${query ? `?${query}` : ''}`
      const baseData = await apiFetch<CalculationDetail[]>(url)
      const rawRows = get().rawRows
      const withRawRow = baseData.map((calc) => {
        const rawRow = rawRows.find((r) => r.id === calc.rawRowId)
        return rawRow ? { ...calc, rawRow } : calc
      })
      set({ calculationDetails: withRawRow })
    } catch {
      set({ calculationDetails: [] })
    }
  },
  reviewCalculation: async (id, reviewStatus, reviewedBy) => {
    await apiFetch(`/api/calculations/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ reviewStatus, reviewedBy }),
    })
    await get().fetchCalculations()
  },
  refreshCalculations: async () => {
    await apiFetch('/api/calculations/refresh', {
      method: 'POST',
    })
    await get().fetchCalculations()
    await get().fetchWorkflowStatus()
  },

  changeRecords: [],
  fetchChangeRecords: async (filters?: { entityType?: string; entityId?: string }) => {
    try {
      const params = new URLSearchParams()
      if (filters?.entityType) params.set('entityType', filters.entityType)
      if (filters?.entityId) params.set('entityId', filters.entityId)
      const query = params.toString()
      const url = `/api/changes${query ? `?${query}` : ''}`
      const data = await apiFetch<ChangeRecord[]>(url)
      set({ changeRecords: data })
    } catch {
      set({ changeRecords: [] })
    }
  },

  importLogs: [],
  fetchImportLogs: async () => {
    try {
      const data = await apiFetch<ImportLog[]>('/api/import-logs')
      set({ importLogs: data })
    } catch {
      set({ importLogs: [] })
    }
  },

  reports: [],
  fetchReports: async () => {
    try {
      const data = await apiFetch<Report[]>('/api/reports')
      set({ reports: data })
    } catch {
      set({ reports: [] })
    }
  },
  generateReport: async () => {
    const result = await apiFetch<Report>('/api/reports/generate', {
      method: 'POST',
    })
    await get().fetchReports()
    return result
  },
  getReport: async (id: string) => {
    return await apiFetch<Report>(`/api/reports/${id}`)
  },
}))
