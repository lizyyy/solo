import { create } from 'zustand'
import type { TransactionWithDetails, Employee, Budget, RiskFlag, ReviewResult } from '../../shared/types'

interface AppState {
  transactions: TransactionWithDetails[]
  employees: Employee[]
  budgets: Budget[]
  stats: {
    totalTransactions: number
    pendingCount: number
    normalCount: number
    warningCount: number
    errorCount: number
    reviewedCount: number
  }
  selectedTransaction: TransactionWithDetails | null
  loading: boolean
  sidebarCollapsed: boolean

  fetchTransactions: (status?: string, keyword?: string) => Promise<void>
  fetchTransactionDetail: (id: string) => Promise<void>
  createTransaction: (data: any) => Promise<any>
  batchImport: (transactions: any[]) => Promise<any>
  fetchEmployees: () => Promise<void>
  fetchBudgets: () => Promise<void>
  fetchStats: () => Promise<void>
  runRiskCheck: (transactionId: string) => Promise<any>
  runRiskCheckAll: () => Promise<any>
  submitReview: (data: { transactionId: string; reviewer: string; decision: string; comment?: string }) => Promise<void>
  setSelectedTransaction: (txn: TransactionWithDetails | null) => void
  toggleSidebar: () => void
  createEmployee: (data: { employeeNo: string; name: string; department: string }) => Promise<void>
  createBudget: (data: { name: string; totalAmount: number; allowedMccs: string[] }) => Promise<void>
}

const API_BASE = '/api'

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data
}

export const useAppStore = create<AppState>((set, get) => ({
  transactions: [],
  employees: [],
  budgets: [],
  stats: { totalTransactions: 0, pendingCount: 0, normalCount: 0, warningCount: 0, errorCount: 0, reviewedCount: 0 },
  selectedTransaction: null,
  loading: false,
  sidebarCollapsed: false,

  fetchTransactions: async (status?, keyword?) => {
    set({ loading: true })
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (keyword) params.set('keyword', keyword)
      const data = await apiFetch(`/transactions?${params.toString()}`)
      set({ transactions: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchTransactionDetail: async (id) => {
    try {
      const data = await apiFetch(`/transactions/${id}`)
      set({ selectedTransaction: data })
    } catch {}
  },

  createTransaction: async (data) => {
    const result = await apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await get().fetchTransactions()
    return result
  },

  batchImport: async (transactions) => {
    const result = await apiFetch('/transactions/batch', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    })
    await get().fetchTransactions()
    return result
  },

  fetchEmployees: async () => {
    const data = await apiFetch('/config/employees')
    set({ employees: data })
  },

  fetchBudgets: async () => {
    const data = await apiFetch('/config/budgets')
    set({ budgets: data })
  },

  fetchStats: async () => {
    const data = await apiFetch('/config/stats')
    set({ stats: data })
  },

  runRiskCheck: async (transactionId) => {
    const result = await apiFetch(`/risk/check/${transactionId}`, { method: 'POST' })
    await get().fetchTransactions()
    await get().fetchStats()
    return result
  },

  runRiskCheckAll: async () => {
    const result = await apiFetch('/risk/check-all', { method: 'POST' })
    await get().fetchTransactions()
    await get().fetchStats()
    return result
  },

  submitReview: async (data) => {
    await apiFetch('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await get().fetchTransactions()
    await get().fetchStats()
  },

  setSelectedTransaction: (txn) => set({ selectedTransaction: txn }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  createEmployee: async (data) => {
    await apiFetch('/config/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await get().fetchEmployees()
  },

  createBudget: async (data) => {
    await apiFetch('/config/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    await get().fetchBudgets()
  },
}))
