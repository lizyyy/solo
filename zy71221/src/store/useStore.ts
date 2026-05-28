import { create } from 'zustand'

type TabKey = 'inventory' | 'reservations' | 'overdue' | 'cancelled' | 'report'

interface ReservationFilter {
  security_code: string
  client_account: string
  status: string
  date_from: string
  date_to: string
}

interface AppStore {
  activeTab: TabKey
  setActiveTab: (tab: TabKey) => void

  inventory: any[]
  reservations: any[]
  loading: boolean
  error: string | null

  filter: ReservationFilter
  setFilter: (filter: Partial<ReservationFilter>) => void
  resetFilter: () => void

  drawerOpen: boolean
  drawerMode: 'create' | 'edit'
  editingReservation: any | null
  openCreateDrawer: () => void
  openEditDrawer: (reservation: any) => void
  closeDrawer: () => void

  confirmDialog: { open: boolean; type: 'return' | 'cancel'; reservation: any | null }
  openConfirmDialog: (type: 'return' | 'cancel', reservation: any) => void
  closeConfirmDialog: () => void

  fetchInventory: () => Promise<void>
  fetchReservations: (filter?: ReservationFilter) => Promise<void>
  createReservation: (data: any) => Promise<boolean>
  updateReservation: (id: number, data: any) => Promise<boolean>
  returnReservation: (id: number) => Promise<boolean>
  cancelReservation: (id: number, reason: string) => Promise<boolean>
  markOverdue: () => Promise<void>

  toast: { message: string; type: 'success' | 'error' } | null
  showToast: (message: string, type: 'success' | 'error') => void
  clearToast: () => void
}

const defaultFilter: ReservationFilter = {
  security_code: '',
  client_account: '',
  status: '',
  date_from: '',
  date_to: '',
}

const buildQueryString = (filter: ReservationFilter) => {
  const params = new URLSearchParams()
  if (filter.security_code) params.set('security_code', filter.security_code)
  if (filter.client_account) params.set('client_account', filter.client_account)
  if (filter.status) params.set('status', filter.status)
  if (filter.date_from) params.set('date_from', filter.date_from)
  if (filter.date_to) params.set('date_to', filter.date_to)
  return params.toString()
}

export const useStore = create<AppStore>((set, get) => ({
  activeTab: 'inventory',
  setActiveTab: (tab) => set({ activeTab: tab }),

  inventory: [],
  reservations: [],
  loading: false,
  error: null,

  filter: { ...defaultFilter },
  setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),
  resetFilter: () => set({ filter: { ...defaultFilter } }),

  drawerOpen: false,
  drawerMode: 'create',
  editingReservation: null,
  openCreateDrawer: () => set({ drawerOpen: true, drawerMode: 'create', editingReservation: null }),
  openEditDrawer: (reservation) => set({ drawerOpen: true, drawerMode: 'edit', editingReservation: reservation }),
  closeDrawer: () => set({ drawerOpen: false, editingReservation: null }),

  confirmDialog: { open: false, type: 'return', reservation: null },
  openConfirmDialog: (type, reservation) => set({ confirmDialog: { open: true, type, reservation } }),
  closeConfirmDialog: () => set({ confirmDialog: { open: false, type: 'return', reservation: null } }),

  fetchInventory: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/inventory')
      const json = await res.json()
      if (json.success) {
        set({ inventory: json.data, loading: false })
      } else {
        set({ error: json.error?.message || '获取库存失败', loading: false })
      }
    } catch (e: any) {
      set({ error: e.message || '网络错误', loading: false })
    }
  },

  fetchReservations: async (filter?: ReservationFilter) => {
    set({ loading: true, error: null })
    try {
      const f = filter || get().filter
      const qs = buildQueryString(f)
      const url = `/api/reservations${qs ? '?' + qs : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        set({ reservations: json.data, loading: false })
      } else {
        set({ error: json.error?.message || '获取预约单失败', loading: false })
      }
    } catch (e: any) {
      set({ error: e.message || '网络错误', loading: false })
    }
  },

  createReservation: async (data) => {
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.success) {
        get().showToast('预约创建成功', 'success')
        get().fetchInventory()
        get().fetchReservations()
        return true
      } else {
        get().showToast(json.error?.message || '创建失败', 'error')
        return false
      }
    } catch (e: any) {
      get().showToast(e.message || '网络错误', 'error')
      return false
    }
  },

  updateReservation: async (id, data) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.success) {
        get().showToast('预约修正成功', 'success')
        get().fetchInventory()
        get().fetchReservations()
        return true
      } else {
        get().showToast(json.error?.message || '修正失败', 'error')
        return false
      }
    } catch (e: any) {
      get().showToast(e.message || '网络错误', 'error')
      return false
    }
  },

  returnReservation: async (id) => {
    try {
      const res = await fetch(`/api/reservations/${id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (json.success) {
        get().showToast('归还操作成功', 'success')
        get().fetchInventory()
        get().fetchReservations()
        return true
      } else {
        get().showToast(json.error?.message || '归还失败', 'error')
        return false
      }
    } catch (e: any) {
      get().showToast(e.message || '网络错误', 'error')
      return false
    }
  },

  cancelReservation: async (id, reason) => {
    try {
      const res = await fetch(`/api/reservations/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = await res.json()
      if (json.success) {
        get().showToast('撤单操作成功', 'success')
        get().fetchInventory()
        get().fetchReservations()
        return true
      } else {
        get().showToast(json.error?.message || '撤单失败', 'error')
        return false
      }
    } catch (e: any) {
      get().showToast(e.message || '网络错误', 'error')
      return false
    }
  },

  markOverdue: async () => {
    try {
      const res = await fetch('/api/mark-overdue', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        get().showToast(`已标记 ${json.data?.updated_count ?? 0} 条逾期记录`, 'success')
        get().fetchInventory()
        get().fetchReservations()
      } else {
        get().showToast(json.error?.message || '标记逾期失败', 'error')
      }
    } catch (e: any) {
      get().showToast(e.message || '网络错误', 'error')
    }
  },

  toast: null,
  showToast: (message, type) => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}))
