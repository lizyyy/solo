import { create } from 'zustand'

export interface AssessmentItem {
  id: string
  file_name: string
  file_hash: string
  line_number: number
  raw_conclusion: string
  direction: string | null
  direction_normalized: string | null
  remark: string
  status: string
  boundary_flag: number
  boundary_rule: string | null
  created_at: string
  updated_at: string
}

export interface ChangeRecord {
  id: string
  item_id: string
  field: string
  old_value: string
  new_value: string
  changed_by: string
  changed_at: string
  reason: string | null
}

export interface BoundaryRule {
  id: string
  pattern: string
  category: string
  normalized_value: string
  action: string
  description: string
  active: number
}

interface AssessmentStore {
  items: AssessmentItem[]
  currentItem: AssessmentItem | null
  history: ChangeRecord[]
  boundaryRules: BoundaryRule[]
  loading: boolean
  importResult: { imported: number; duplicates: { fileName: string; lineNumber: number }[] } | null

  fetchItems: (status?: string) => Promise<void>
  fetchItem: (id: string) => Promise<void>
  importPhotos: (photos: { fileName: string; fileHash: string; lineNumber: number; rawConclusion: string; rawDirection?: string }[]) => Promise<void>
  updateRemark: (itemId: string, remark: string, directionOverride?: string) => Promise<void>
  reviewAssessment: (itemId: string, action: 'confirm_abnormal' | 'mark_normal' | 'return_to_inspector', reason: string) => Promise<void>
  fetchHistory: (itemId: string) => Promise<void>
  fetchBoundaryRules: () => Promise<void>
  clearImportResult: () => void
}

export const useAssessmentStore = create<AssessmentStore>((set) => ({
  items: [],
  currentItem: null,
  history: [],
  boundaryRules: [],
  loading: false,
  importResult: null,

  fetchItems: async (status?: string) => {
    set({ loading: true })
    try {
      const url = status && status !== '全部' ? `/api/assessments?status=${encodeURIComponent(status)}` : '/api/assessments'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) set({ items: data.data })
    } finally {
      set({ loading: false })
    }
  },

  fetchItem: async (id: string) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/assessments/${id}`)
      const data = await res.json()
      if (data.success) set({ currentItem: data.data })
    } finally {
      set({ loading: false })
    }
  },

  importPhotos: async (photos) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/assessments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos, operator: '质检员小白' }),
      })
      const data = await res.json()
      if (data.success) {
        set({ importResult: { imported: data.data.imported, duplicates: data.data.duplicates } })
        const itemsRes = await fetch('/api/assessments')
        const itemsData = await itemsRes.json()
        if (itemsData.success) set({ items: itemsData.data })
      }
    } finally {
      set({ loading: false })
    }
  },

  updateRemark: async (itemId, remark, directionOverride) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/assessments/${itemId}/remark`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark, directionOverride, operator: '质检员小白' }),
      })
      const data = await res.json()
      if (data.success) {
        set((state) => ({
          items: state.items.map((item) => item.id === itemId ? data.data.item : item),
          currentItem: state.currentItem?.id === itemId ? data.data.item : state.currentItem,
        }))
      }
    } finally {
      set({ loading: false })
    }
  },

  reviewAssessment: async (itemId, action, reason) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/assessments/${itemId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason, operator: '实验老师' }),
      })
      const data = await res.json()
      if (data.success) {
        set((state) => ({
          items: state.items.map((item) => item.id === itemId ? data.data : item),
          currentItem: state.currentItem?.id === itemId ? data.data : state.currentItem,
        }))
      }
    } finally {
      set({ loading: false })
    }
  },

  fetchHistory: async (itemId) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/assessments/${itemId}/history`)
      const data = await res.json()
      if (data.success) set({ history: data.data })
    } finally {
      set({ loading: false })
    }
  },

  fetchBoundaryRules: async () => {
    try {
      const res = await fetch('/api/boundary-rules')
      const data = await res.json()
      if (data.success) set({ boundaryRules: data.data })
    } catch {}
  },

  clearImportResult: () => set({ importResult: null }),
}))
