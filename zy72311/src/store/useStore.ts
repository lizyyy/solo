import { create } from 'zustand'

export type StepStatus = 'imported' | 'reviewed' | 'updated'

export type RecordStatus =
  | 'normal'
  | 'zero_denominator_empty'
  | 'supplemented'
  | 'pending'
  | 'review'
  | 'confirmed'
  | 'rejected'

export interface ImportRow {
  target_name: string
  weight: string
  score: string
  denominator: string
}

export interface QuestionnaireRecord {
  id: string
  batchId: string
  targetName: string
  weight: number
  score: number
  denominator: number
  rawValue: string
  recordType: RecordStatus
  source: string
  status: RecordStatus
  createdAt: string
  boundaryNoteId?: string
  originalStatement?: string
  nextHandler?: string
}

export interface QuestionnaireSummary {
  total: number
  normal: number
  zeroDenominator: number
  supplemented: number
  pendingReview: number
}

export interface Conflict {
  id: string
  questionnaireRecordId: string
  boundaryNoteId: string
  fieldName: string
  questionnaireValue: string
  boundaryNoteValue: string
  diffDescription: string
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
}

export interface BoundaryNote {
  id: string
  title: string
  content: string
  relatedFields: string[]
  methodology: string
  effectiveDate: string
}

export interface ReviewTask {
  id: string
  recordId: string
  reviewer: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string
  createdAt: string
  targetName: string
  recordType: RecordStatus
  rawValue: string
  originalStatement?: string
  correctedValue?: number
  nextHandler?: string
  boundaryNoteId?: string
}

export interface AuditLog {
  id: string
  operator: string
  action: 'import' | 'supplement' | 'resolve_conflict' | 'update_result' | 'review'
  targetType: string
  targetId: string
  beforeValue: any
  afterValue: any
  reason: string
  affectedResults: string[]
  createdAt: string
}

export interface ScoringResult {
  id: string
  targetName: string
  weight: number
  score: number
  weightedScore: number
  source: string
  version: number
  previousScore?: number
  previousWeightedScore?: number
  boundaryNoteId?: string
}

export interface ScoringData {
  results: ScoringResult[]
  stepStatus: StepStatus
  totalWeight: number
  totalScore: number
}

interface DashboardData {
  questionnaire: {
    records: QuestionnaireRecord[]
    summary: QuestionnaireSummary
  }
  conflicts: Conflict[]
  reviewTasks: ReviewTask[]
  scoring: ScoringData
  auditLogs: AuditLog[]
}

interface ReviewExtra {
  originalStatement?: string
  correctedValue?: number
  nextHandler?: string
}

interface StoreState {
  currentStep: StepStatus
  batchId: string | null
  questionnaireRecords: QuestionnaireRecord[]
  questionnaireSummary: QuestionnaireSummary
  conflicts: Conflict[]
  allConflicts: Conflict[]
  boundaryNotes: BoundaryNote[]
  reviewTasks: ReviewTask[]
  auditLogs: AuditLog[]
  scoringData: ScoringData | null
  loading: boolean
  error: string | null
  supplementResult: { conflictDetected: boolean; conflictId?: string } | null

  fetchDashboard: () => Promise<void>
  importData: (csvText: string) => Promise<void>
  supplementFromNote: (noteId: string, targetField: string, value: number, reason: string) => Promise<{ conflictDetected: boolean; conflictId?: string } | null>
  resolveConflict: (conflictId: string, decision: 'confirm' | 'reject', reason: string) => Promise<void>
  updateResults: () => Promise<void>
  fetchAuditLogs: (filters?: { operator?: string; action?: string; from?: string; to?: string; keyword?: string }) => Promise<void>
  fetchReviewTasks: () => Promise<void>
  fetchBoundaryNotes: () => Promise<void>
  fetchScoringResults: () => Promise<void>
  fetchAllConflicts: () => Promise<void>
  approveReviewTask: (taskId: string, note: string, extra?: ReviewExtra) => Promise<void>
  rejectReviewTask: (taskId: string, note: string, extra?: ReviewExtra) => Promise<void>
}

const API_BASE = '/api'

const parseJSON = (str: string | null | undefined): any => {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

const convertSnakeToCamel = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(convertSnakeToCamel)
  }
  if (obj !== null && typeof obj === 'object') {
    const result: any = {}
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      result[camelKey] = convertSnakeToCamel(obj[key])
    }
    return result
  }
  return obj
}

export const useStore = create<StoreState>((set, get) => ({
  currentStep: 'imported',
  batchId: null,
  questionnaireRecords: [],
  questionnaireSummary: {
    total: 0,
    normal: 0,
    zeroDenominator: 0,
    supplemented: 0,
    pendingReview: 0,
  },
  conflicts: [],
  allConflicts: [],
  boundaryNotes: [],
  reviewTasks: [],
  auditLogs: [],
  scoringData: null,
  loading: false,
  error: null,
  supplementResult: null,

  fetchDashboard: async () => {
    set({ loading: true, error: null })
    try {
      const [qRes, cRes, rRes, sRes, aRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/questionnaire`),
        fetch(`${API_BASE}/conflicts?status=pending`),
        fetch(`${API_BASE}/review`),
        fetch(`${API_BASE}/scoring/results`),
        fetch(`${API_BASE}/audit-logs`),
        fetch(`${API_BASE}/boundary-notes`),
      ])

      const qData = await qRes.json()
      const cData = await cRes.json()
      const rData = await rRes.json()
      const sData = await sRes.json()
      const aData = await aRes.json()
      const bData = await bRes.json()

      const records = convertSnakeToCamel(qData.data?.records || [])
      const summary = convertSnakeToCamel(qData.data?.summary || {})
      const conflicts = convertSnakeToCamel(cData.data?.conflicts || [])
      const reviewTasks = convertSnakeToCamel(rData.data?.tasks || [])
      const scoringResults = convertSnakeToCamel(sData.data?.results || [])
      const auditLogs = (aData.data?.logs || []).map((log: any) => {
        const camel = convertSnakeToCamel(log)
        return {
          ...camel,
          beforeValue: parseJSON(camel.beforeValue),
          afterValue: parseJSON(camel.afterValue),
          affectedResults: parseJSON(camel.affectedResults) || [],
        }
      })
      const boundaryNotes = (bData.data?.notes || []).map((note: any) => {
        const camel = convertSnakeToCamel(note)
        return {
          ...camel,
          relatedFields: parseJSON(camel.relatedFields) || [],
        }
      })

      const scoringData: ScoringData = {
        results: scoringResults,
        stepStatus: sData.data?.stepStatus || 'imported',
        totalWeight: sData.data?.totalWeight || 0,
        totalScore: sData.data?.totalScore || 0,
      }

      set({
        questionnaireRecords: records,
        questionnaireSummary: summary,
        conflicts,
        reviewTasks,
        scoringData,
        auditLogs,
        boundaryNotes,
        currentStep: sData.data?.stepStatus || 'imported',
        loading: false,
      })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  importData: async (csvText: string) => {
    set({ loading: true, error: null })
    try {
      const lines = csvText.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim())
      const data: ImportRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row: any = {}
        headers.forEach((header, idx) => {
          row[header] = values[idx] || ''
        })
        data.push(row)
      }

      const batchId = 'batch-' + Date.now()

      const res = await fetch(`${API_BASE}/questionnaire/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, batchId }),
      })

      if (!res.ok) throw new Error('导入数据失败')
      const result = await res.json()

      set({
        batchId,
        currentStep: 'imported',
        loading: false,
      })

      await get().fetchDashboard()
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  supplementFromNote: async (noteId: string, targetField: string, value: number, reason: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/boundary-notes/supplement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, targetField, supplementValue: String(value), reason }),
      })

      if (!res.ok) throw new Error('补录数据失败')
      const result = await res.json()
      const data = result.data

      set({
        supplementResult: { conflictDetected: data.conflictDetected, conflictId: data.conflictId },
        loading: false,
      })

      await Promise.all([
        get().fetchDashboard(),
        get().fetchBoundaryNotes(),
      ])
      return data
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  resolveConflict: async (conflictId: string, decision: 'confirm' | 'reject', reason: string) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/conflicts/${conflictId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason, operator: '小祁' }),
      })

      if (!res.ok) throw new Error('解决冲突失败')
      set({ loading: false })
      await Promise.all([
        get().fetchDashboard(),
        get().fetchScoringResults(),
        get().fetchBoundaryNotes(),
        get().fetchAllConflicts(),
      ])
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  updateResults: async () => {
    set({ loading: true, error: null })
    try {
      const { batchId } = get()
      const body: any = {}
      if (batchId) {
        body.batchId = batchId
      }

      const res = await fetch(`${API_BASE}/scoring/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('更新评分结果失败')
      const result = await res.json()
      const data = result.data

      const previousResults = convertSnakeToCamel(data.previousResults || [])
      const updatedResults = convertSnakeToCamel(data.updatedResults || [])

      const resultsWithComparison = updatedResults.map((current: ScoringResult) => {
        const previous = previousResults.find((p: ScoringResult) => p.targetName === current.targetName)
        return {
          ...current,
          previousScore: previous?.score,
          previousWeightedScore: previous?.weightedScore,
        }
      })

      set((state) => ({
        scoringData: state.scoringData
          ? { ...state.scoringData, results: resultsWithComparison, stepStatus: 'updated' }
          : null,
        currentStep: 'updated',
        loading: false,
      }))

      await get().fetchDashboard()
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchAuditLogs: async (filters) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters?.operator) params.set('operator', filters.operator)
      if (filters?.action) params.set('action', filters.action)
      if (filters?.from) params.set('from', filters.from)
      if (filters?.to) params.set('to', filters.to)
      if (filters?.keyword) params.set('keyword', filters.keyword)

      const res = await fetch(`${API_BASE}/audit-logs?${params.toString()}`)
      if (!res.ok) throw new Error('获取审计日志失败')
      const data = await res.json()

      const logs = (data.data?.logs || []).map((log: any) => {
        const camel = convertSnakeToCamel(log)
        return {
          ...camel,
          beforeValue: parseJSON(camel.beforeValue),
          afterValue: parseJSON(camel.afterValue),
          affectedResults: parseJSON(camel.affectedResults) || [],
        }
      })

      set({ auditLogs: logs, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchReviewTasks: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/review`)
      if (!res.ok) throw new Error('获取复核任务失败')
      const data = await res.json()
      const tasks = convertSnakeToCamel(data.data?.tasks || [])
      set({ reviewTasks: tasks, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchBoundaryNotes: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/boundary-notes`)
      if (!res.ok) throw new Error('获取边界值说明失败')
      const data = await res.json()
      const notes = (data.data?.notes || []).map((note: any) => {
        const camel = convertSnakeToCamel(note)
        return {
          ...camel,
          relatedFields: parseJSON(camel.relatedFields) || [],
        }
      })
      set({ boundaryNotes: notes, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchScoringResults: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/scoring/results`)
      if (!res.ok) throw new Error('获取评分结果失败')
      const data = await res.json()
      const results = convertSnakeToCamel(data.data?.results || [])

      const scoringData: ScoringData = {
        results,
        stepStatus: data.data?.stepStatus || 'imported',
        totalWeight: data.data?.totalWeight || 0,
        totalScore: data.data?.totalScore || 0,
      }

      set({ scoringData, currentStep: data.data?.stepStatus || 'imported', loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchAllConflicts: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/conflicts`)
      if (!res.ok) throw new Error('获取冲突记录失败')
      const data = await res.json()
      const conflicts = convertSnakeToCamel(data.data?.conflicts || [])
      set({ allConflicts: conflicts, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  approveReviewTask: async (taskId: string, note: string, extra?: ReviewExtra) => {
    set({ loading: true, error: null })
    try {
      const body: any = { decision: 'approved', note, operator: '复核员' }
      if (extra) {
        if (extra.originalStatement) body.originalStatement = extra.originalStatement
        if (extra.correctedValue !== undefined) body.correctedValue = extra.correctedValue
        if (extra.nextHandler) body.nextHandler = extra.nextHandler
      }
      const res = await fetch(`${API_BASE}/review/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('复核失败')
      set({ loading: false })
      await get().fetchDashboard()
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  rejectReviewTask: async (taskId: string, note: string, extra?: ReviewExtra) => {
    set({ loading: true, error: null })
    try {
      const body: any = { decision: 'rejected', note, operator: '复核员' }
      if (extra) {
        if (extra.originalStatement) body.originalStatement = extra.originalStatement
        if (extra.correctedValue !== undefined) body.correctedValue = extra.correctedValue
        if (extra.nextHandler) body.nextHandler = extra.nextHandler
      }
      const res = await fetch(`${API_BASE}/review/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('复核失败')
      set({ loading: false })
      await get().fetchDashboard()
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },
}))
