import { create } from 'zustand'

interface WorkflowState {
  currentStep: 'import' | 'counterexample_review' | 'demo_update'
  importCompleted: boolean
  counterexampleReviewCompleted: boolean
  demoUpdateCompleted: boolean
  pendingConflicts: number
  pendingReviews: number
}

interface SelfCheckResult {
  type: 'duplicate_import' | 'denominator_zero_empty' | 'recalc_after_supplement' | 'export_consistency'
  status: 'pass' | 'fail' | 'warning'
  message: string
  details: Array<{ id: string; description: string }>
}

interface ParamVersion {
  id: string
  version: number
  importedAt: string
  importedBy: string
  itemCount: number
  changeSummary: string
}

interface ParamItem {
  id: string
  versionId: string
  name: string
  value: string
  rationale: string
  isDenominatorZero: boolean
  rawDenominatorValue: string
  reviewStatus: 'normal' | 'pending_review' | 'reviewed'
  previousValue: string
  adjudicationNote: string
  reviewNote: string
  nextAction: string
  lastActor: string
}

interface Counterexample {
  id: string
  name: string
  note: string
  noteRaw: string
  expectedValue: string
  actualValue: string
  sourceParamId: string
  hasConflict: boolean
  createdAt: string
  previousValue: string
  adjudicationNote: string
  reviewNote: string
  nextAction: string
  lastActor: string
}

interface Conflict {
  id: string
  paramItemId: string
  counterexampleId: string
  paramValue: string
  counterexampleValue: string
  counterexampleNote: string
  status: 'pending' | 'confirmed' | 'rejected'
  detectedAt: string
}

interface DemoResult {
  id: string
  paramItemId: string
  paramName: string
  value: string
  paramVersion: string
  rationale: string
  isDenominatorZero: boolean
  reviewStatus: 'normal' | 'pending_review' | 'reviewed'
  displayLabel: string
  previousValue: string
  adjudicationNote: string
  reviewNote: string
  nextAction: string
  lastActor: string
  counterexampleNoteRaw: string
}

interface AuditLog {
  id: string
  recordType: string
  recordId: string
  paramItemId: string
  counterexampleId: string
  actionType: string
  previousValue: string
  newValue: string
  reason: string
  note: string
  actor: string
  nextAction: string
  details: any
  createdAt: string
}

interface AppStore {
  workflow: WorkflowState | null
  selfChecks: SelfCheckResult[]
  selfCheckRunAt: string | null
  paramVersions: ParamVersion[]
  paramItems: ParamItem[]
  counterexamples: Counterexample[]
  conflicts: Conflict[]
  demoResults: DemoResult[]
  auditLogs: AuditLog[]
  loading: boolean
  error: string | null

  fetchWorkflow: () => Promise<void>
  fetchSelfChecks: () => Promise<void>
  runSelfChecks: () => Promise<void>
  fetchParamVersions: () => Promise<void>
  fetchParamItems: (versionId?: string) => Promise<void>
  importParams: (items: Record<string, unknown>[]) => Promise<{ duplicateCount: number; importedCount: number; duplicates: Record<string, unknown>[]; versionId: string; version: number }>
  fetchCounterexamples: () => Promise<void>
  createCounterexample: (data: { name: string; note: string; expectedValue: string; actualValue: string; sourceParamId: string }) => Promise<void>
  fetchConflicts: (status?: string) => Promise<void>
  adjudicateConflict: (id: string, decision: 'confirmed' | 'rejected', reason: string, adjudicator: string) => Promise<void>
  fetchDemoResults: () => Promise<void>
  recalculateDemo: (triggerWorkflowStep: string) => Promise<void>
  exportDemo: () => Promise<{ data: DemoResult[]; exportedAt: string; checksum: string }>
  advanceWorkflow: (step: string) => Promise<void>
  reviewDenominatorZero: (itemId: string, decision: 'confirm_anomaly' | 'confirm_corrected', reviewer: string, reason: string) => Promise<void>
  fetchAuditLogs: (paramItemId?: string, counterexampleId?: string) => Promise<void>
  fetchAuditTimeline: (paramItemId: string) => Promise<void>
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `请求失败: ${res.status}`)
  }
  const json = await res.json()
  return json.success ? json.data : json
}

export const useAppStore = create<AppStore>((set, get) => ({
  workflow: null,
  selfChecks: [],
  selfCheckRunAt: null,
  paramVersions: [],
  paramItems: [],
  counterexamples: [],
  conflicts: [],
  demoResults: [],
  auditLogs: [],
  loading: false,
  error: null,

  fetchWorkflow: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<any>('/api/workflow/state')
      const converted: WorkflowState = {
        currentStep: data.current_step || 'import',
        importCompleted: !!data.import_completed,
        counterexampleReviewCompleted: !!data.counterexample_review_completed,
        demoUpdateCompleted: !!data.demo_update_completed,
        pendingConflicts: data.pendingConflicts ?? data.pending_conflicts ?? 0,
        pendingReviews: data.pendingReviews ?? data.pending_reviews ?? 0,
      }
      set({ workflow: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchSelfChecks: async () => {
    set({ loading: true, error: null })
    try {
      const raw = await apiFetch<any>(`/api/checks/latest`)
      const list = Array.isArray(raw) ? raw : (raw?.results || raw?.data || [])
      const mapped: SelfCheckResult[] = list.map((c: any) => {
        let parsedDetails: Array<{ id: string; description: string }> = []
        try {
          const rawDetails = typeof c.details === 'string' ? JSON.parse(c.details) : (c.details || [])
          parsedDetails = (rawDetails || []).map((d: any) => ({
            id: d.id,
            description: d.description ?? d.name ?? d.message ?? '',
          }))
        } catch { /* ignore */ }
        return {
          type: c.type || c.check_type,
          status: c.status,
          message: c.message,
          details: parsedDetails,
        }
      })
      let runAt: string | null = null
      if (list.length > 0 && list[0].run_at) runAt = list[0].run_at
      else if (raw?.runAt) runAt = raw.runAt
      set({ selfChecks: mapped, selfCheckRunAt: runAt, loading: false })
    } catch {
      set({ selfChecks: [], loading: false })
    }
  },

  runSelfChecks: async () => {
    set({ loading: true, error: null })
    try {
      await apiFetch<any>('/api/checks/run', { method: 'POST' })
      await get().fetchSelfChecks()
      await get().fetchAuditLogs()
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchParamVersions: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<any[]>('/api/params/versions')
      const converted = data.map((v: any) => ({
        id: v.id,
        version: v.version,
        importedAt: v.imported_at,
        importedBy: v.imported_by,
        itemCount: v.item_count,
        changeSummary: v.change_summary,
      }))
      set({ paramVersions: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchParamItems: async (versionId?: string) => {
    set({ loading: true, error: null })
    try {
      const url = versionId ? `/api/params/items?versionId=${versionId}` : '/api/params/items'
      const data = await apiFetch<any[]>(url)
      const converted = data.map((item: any) => ({
        id: item.id,
        versionId: item.version_id,
        name: item.name,
        value: item.value,
        rationale: item.rationale,
        isDenominatorZero: !!item.is_denominator_zero,
        rawDenominatorValue: item.raw_denominator_value,
        reviewStatus: item.review_status,
        previousValue: item.previous_value ?? '',
        adjudicationNote: item.adjudication_note ?? '',
        reviewNote: item.review_note ?? '',
        nextAction: item.next_action ?? '',
        lastActor: item.last_actor ?? '',
      }))
      set({ paramItems: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  importParams: async (items: Record<string, unknown>[]) => {
    set({ loading: true, error: null })
    try {
      const result = await apiFetch<{ duplicateCount: number; importedCount: number; duplicates: Record<string, unknown>[]; versionId: string; version: number }>('/api/params/import', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      await get().fetchParamVersions()
      await get().fetchParamItems()
      await get().fetchWorkflow()
      await get().fetchDemoResults()
      await get().fetchSelfChecks()
      await get().fetchAuditLogs()
      set({ loading: false })
      return result
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
      throw e
    }
  },

  fetchCounterexamples: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<any[]>('/api/counterexamples')
      const converted = data.map((ce: any) => ({
        id: ce.id,
        name: ce.name,
        note: ce.note,
        noteRaw: ce.note_raw,
        expectedValue: ce.expected_value,
        actualValue: ce.actual_value,
        sourceParamId: ce.source_param_id,
        hasConflict: !!ce.has_conflict,
        createdAt: ce.created_at,
        previousValue: ce.previous_value ?? '',
        adjudicationNote: ce.adjudication_note ?? '',
        reviewNote: ce.review_note ?? '',
        nextAction: ce.next_action ?? '',
        lastActor: ce.last_actor ?? '',
      }))
      set({ counterexamples: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  createCounterexample: async (data: { name: string; note: string; expectedValue: string; actualValue: string; sourceParamId: string }) => {
    set({ loading: true, error: null })
    try {
      await apiFetch('/api/counterexamples', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await get().fetchCounterexamples()
      await get().fetchConflicts()
      await get().fetchWorkflow()
      await get().fetchParamItems()
      await get().fetchAuditLogs()
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchConflicts: async (status?: string) => {
    set({ loading: true, error: null })
    try {
      const url = status ? `/api/conflicts?status=${status}` : '/api/conflicts'
      const data = await apiFetch<any[]>(url)
      const converted = data.map((c: any) => ({
        id: c.id,
        paramItemId: c.param_item_id,
        counterexampleId: c.counterexample_id,
        paramValue: c.param_value,
        counterexampleValue: c.counterexample_value,
        counterexampleNote: c.counterexample_note,
        status: c.status,
        detectedAt: c.detected_at,
      }))
      set({ conflicts: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  adjudicateConflict: async (id: string, decision: 'confirmed' | 'rejected', reason: string, adjudicator: string) => {
    set({ loading: true, error: null })
    try {
      await apiFetch(`/api/conflicts/${id}/adjudicate`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason, adjudicator }),
      })
      await get().fetchParamItems()
      await get().fetchDemoResults()
      await get().fetchWorkflow()
      await get().fetchSelfChecks()
      await get().fetchAuditLogs()
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchDemoResults: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<any[]>('/api/demo/results')
      const converted = data.map((item: any) => ({
        id: item.id,
        paramItemId: item.param_item_id,
        paramName: item.param_name,
        value: item.value,
        paramVersion: item.param_version,
        rationale: item.rationale,
        isDenominatorZero: !!item.is_denominator_zero,
        reviewStatus: item.review_status,
        displayLabel: item.display_label,
        previousValue: item.previous_value ?? '',
        adjudicationNote: item.adjudication_note ?? '',
        reviewNote: item.review_note ?? '',
        nextAction: item.next_action ?? '',
        lastActor: item.last_actor ?? '',
        counterexampleNoteRaw: item.counterexample_note_raw ?? '',
      }))
      set({ demoResults: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  recalculateDemo: async (triggerWorkflowStep: string) => {
    set({ loading: true, error: null })
    try {
      await apiFetch('/api/demo/recalculate', {
        method: 'POST',
        body: JSON.stringify({ triggerWorkflowStep }),
      })
      await get().fetchDemoResults()
      await get().fetchSelfChecks()
      await get().fetchAuditLogs()
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  exportDemo: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ data: DemoResult[]; exportedAt: string; checksum: string }>('/api/demo/export')
      set({ loading: false })
      return data
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
      throw e
    }
  },

  advanceWorkflow: async (step: string) => {
    set({ loading: true, error: null })
    try {
      await apiFetch('/api/workflow/advance', {
        method: 'POST',
        body: JSON.stringify({ step }),
      })
      await get().fetchWorkflow()
      await get().fetchParamItems()
      await get().fetchDemoResults()
      await get().fetchSelfChecks()
      await get().fetchAuditLogs()
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  reviewDenominatorZero: async (itemId: string, decision: 'confirm_anomaly' | 'confirm_corrected', reviewer: string, reason: string) => {
    set({ loading: true, error: null })
    try {
      await apiFetch('/api/workflow/review-denominator-zero', {
        method: 'POST',
        body: JSON.stringify({ itemId, decision, reviewer, reason }),
      })
      await get().fetchParamItems()
      await get().fetchDemoResults()
      await get().fetchWorkflow()
      await get().fetchSelfChecks()
      await get().fetchAuditLogs()
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchAuditLogs: async (paramItemId?: string, counterexampleId?: string) => {
    set({ loading: true, error: null })
    try {
      let url = '/api/history'
      const params: string[] = []
      if (paramItemId) params.push(`paramItemId=${paramItemId}`)
      if (counterexampleId) params.push(`counterexampleId=${counterexampleId}`)
      if (params.length > 0) url += '?' + params.join('&')
      const data = await apiFetch<any[]>(url)
      const converted = data.map((log: any) => ({
        id: log.id,
        recordType: log.record_type,
        recordId: log.record_id,
        paramItemId: log.param_item_id,
        counterexampleId: log.counterexample_id,
        actionType: log.action_type,
        previousValue: log.previous_value,
        newValue: log.new_value,
        reason: log.reason,
        note: log.note,
        actor: log.actor,
        nextAction: log.next_action,
        details: log.details,
        createdAt: log.created_at,
      }))
      set({ auditLogs: converted, loading: false })
    } catch {
      set({ auditLogs: [], loading: false })
    }
  },

  fetchAuditTimeline: async (paramItemId: string) => {
    set({ loading: true, error: null })
    try {
      const raw = await apiFetch<any>(`/api/history/for/${paramItemId}`)
      const logs = Array.isArray(raw) ? raw : ((raw && (raw as any).auditLogs) || []) as any[]
      const converted = logs.map((log: any) => ({
        id: log.id,
        recordType: log.record_type,
        recordId: log.record_id,
        paramItemId: log.param_item_id,
        counterexampleId: log.counterexample_id,
        actionType: log.action_type,
        previousValue: log.previous_value,
        newValue: log.new_value,
        reason: log.reason,
        note: log.note,
        actor: log.actor,
        nextAction: log.next_action,
        details: log.details,
        createdAt: log.created_at,
      }))
      set({ auditLogs: converted, loading: false })
    } catch {
      set({ auditLogs: [], loading: false })
    }
  },
}))

export type { WorkflowState, SelfCheckResult, ParamVersion, ParamItem, Counterexample, Conflict, DemoResult, AuditLog }
