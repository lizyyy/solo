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
        pendingConflicts: data.pendingConflicts ?? 0,
        pendingReviews: data.pendingReviews ?? 0,
      }
      set({ workflow: converted, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },

  fetchSelfChecks: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ results: SelfCheckResult[]; runAt: string }>('/api/checks/latest')
      set({ selfChecks: data.results || [], selfCheckRunAt: data.runAt || null, loading: false })
    } catch (e: unknown) {
      set({ selfChecks: [], loading: false })
    }
  },

  runSelfChecks: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ results: SelfCheckResult[]; runAt: string }>('/api/checks/run', { method: 'POST' })
      set({ selfChecks: data.results || [], selfCheckRunAt: data.runAt || null, loading: false })
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
      await get().fetchConflicts()
      await get().fetchCounterexamples()
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
      await get().fetchDemoResults()
      await get().fetchParamItems()
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false })
    }
  },
}))

export type { WorkflowState, SelfCheckResult, ParamVersion, ParamItem, Counterexample, Conflict, DemoResult }
