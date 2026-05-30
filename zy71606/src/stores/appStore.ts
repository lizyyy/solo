import { create } from 'zustand'
import type {
  Client,
  MarketSnapshot,
  Notification,
  NotificationStatusLog,
  Deposit,
  ImportBatch,
  ImportRecord,
  Report,
  ReportSnapshot,
  RiskLevel,
  NotificationType,
  NotificationStatus,
  MatchStatus,
  FileType,
  ImportBatchStatus,
} from '@/lib/api'
import {
  clientsApi,
  marketApi,
  notificationsApi,
  importApi,
  depositsApi,
  reportsApi,
} from '@/lib/api'

interface AppState {
  clients: {
    list: Client[]
    total: number
    selected: Client | null
    filters: { search: string; risk_level: RiskLevel | ''; page: number; pageSize: number }
    loading: boolean
  }
  notifications: {
    list: Notification[]
    total: number
    selected: Notification | null
    statusLogs: NotificationStatusLog[]
    filters: { client_id: string; type: NotificationType | ''; status: NotificationStatus | ''; start_date: string; end_date: string; page: number; pageSize: number }
    loading: boolean
    duplicateWarning: Notification | null
  }
  deposits: {
    list: Deposit[]
    total: number
    selected: Deposit | null
    filters: { client_id: string; match_status: MatchStatus | ''; start_date: string; end_date: string; page: number; pageSize: number }
    loading: boolean
  }
  market: {
    snapshots: MarketSnapshot[]
    loading: boolean
  }
  imports: {
    batches: ImportBatch[]
    currentRecords: ImportRecord[]
    currentBatch: ImportBatch | null
    mergeResult: { merged: number; preserved: number; risk_updated: number } | null
    loading: boolean
    activeTab: FileType
  }
  reports: {
    list: Report[]
    total: number
    current: (Report & { content: ReportSnapshot }) | null
    history: ReportSnapshot[]
    filters: { start_date: string; end_date: string; risk_level: RiskLevel | ''; page: number; pageSize: number }
    loading: boolean
  }
  ui: {
    sidebarCollapsed: boolean
    marketPanelOpen: boolean
    confirmModal: { open: boolean; title: string; message: string; onConfirm: () => void } | null
  }
}

interface AppActions {
  fetchClients: () => Promise<void>
  setClientFilters: (filters: Partial<AppState['clients']['filters']>) => void
  selectClient: (client: Client | null) => void

  fetchNotifications: () => Promise<void>
  setNotificationFilters: (filters: Partial<AppState['notifications']['filters']>) => void
  selectNotification: (n: Notification | null) => void
  createNotification: (data: { client_id: string; type: NotificationType; margin_shortfall: number; content: string }) => Promise<Notification>
  sendNotification: (id: string) => Promise<void>
  withdrawNotification: (id: string, reason: string) => Promise<void>
  checkDuplicate: (clientId: string, type: NotificationType, date: string) => Promise<void>
  clearDuplicateWarning: () => void
  fetchStatusLogs: (notificationId: string) => Promise<void>

  fetchDeposits: () => Promise<void>
  setDepositFilters: (filters: Partial<AppState['deposits']['filters']>) => void
  selectDeposit: (d: Deposit | null) => void
  createDeposit: (data: { client_id: string; amount: number; deposit_time: string }) => Promise<void>
  triggerAutoMatch: () => Promise<void>
  manualMatch: (depositId: string, notificationId: string, amount: number) => Promise<void>

  fetchMarket: () => Promise<void>

  uploadFiles: (formData: FormData) => Promise<void>
  fetchImportStatus: (batchId: string) => Promise<void>
  confirmImport: (batchId: string) => Promise<void>
  cancelImport: (batchId: string) => Promise<void>
  setImportTab: (tab: FileType) => void

  fetchReports: () => Promise<void>
  fetchReport: (id: string) => Promise<void>
  generateReport: () => Promise<void>
  setReportFilters: (filters: Partial<AppState['reports']['filters']>) => void
  fetchReportHistory: () => Promise<void>

  toggleSidebar: () => void
  toggleMarketPanel: () => void
  showConfirmModal: (title: string, message: string, onConfirm: () => void) => void
  hideConfirmModal: () => void
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  clients: {
    list: [],
    total: 0,
    selected: null,
    filters: { search: '', risk_level: '', page: 1, pageSize: 20 },
    loading: false,
  },
  notifications: {
    list: [],
    total: 0,
    selected: null,
    statusLogs: [],
    filters: { client_id: '', type: '', status: '', start_date: '', end_date: '', page: 1, pageSize: 20 },
    loading: false,
    duplicateWarning: null,
  },
  deposits: {
    list: [],
    total: 0,
    selected: null,
    filters: { client_id: '', match_status: '', start_date: '', end_date: '', page: 1, pageSize: 20 },
    loading: false,
  },
  market: { snapshots: [], loading: false },
  imports: {
    batches: [],
    currentRecords: [],
    currentBatch: null,
    mergeResult: null,
    loading: false,
    activeTab: 'position',
  },
  reports: {
    list: [],
    total: 0,
    current: null,
    history: [],
    filters: { start_date: '', end_date: '', risk_level: '', page: 1, pageSize: 20 },
    loading: false,
  },
  ui: {
    sidebarCollapsed: false,
    marketPanelOpen: false,
    confirmModal: null,
  },

  fetchClients: async () => {
    set(s => ({ clients: { ...s.clients, loading: true } }))
    try {
      const f = get().clients.filters
      const res = await clientsApi.getClients({
        search: f.search || undefined,
        risk_level: f.risk_level || undefined,
        page: f.page,
        pageSize: f.pageSize,
      })
      set(s => ({ clients: { ...s.clients, list: res.items as Client[], total: res.total, loading: false } }))
    } catch {
      set(s => ({ clients: { ...s.clients, loading: false } }))
    }
  },
  setClientFilters: (filters) => {
    set(s => ({ clients: { ...s.clients, filters: { ...s.clients.filters, ...filters } } }))
  },
  selectClient: (client) => {
    set(s => ({ clients: { ...s.clients, selected: client } }))
  },

  fetchNotifications: async () => {
    set(s => ({ notifications: { ...s.notifications, loading: true } }))
    try {
      const f = get().notifications.filters
      const res = await notificationsApi.getNotifications({
        client_id: f.client_id || undefined,
        type: f.type || undefined,
        status: f.status || undefined,
        start_date: f.start_date || undefined,
        end_date: f.end_date || undefined,
        page: f.page,
        pageSize: f.pageSize,
      })
      set(s => ({ notifications: { ...s.notifications, list: res.items as Notification[], total: res.total, loading: false } }))
    } catch {
      set(s => ({ notifications: { ...s.notifications, loading: false } }))
    }
  },
  setNotificationFilters: (filters) => {
    set(s => ({ notifications: { ...s.notifications, filters: { ...s.notifications.filters, ...filters } } }))
  },
  selectNotification: (n) => {
    set(s => ({ notifications: { ...s.notifications, selected: n } }))
  },
  createNotification: async (data) => {
    const n = await notificationsApi.createNotification(data)
    set(s => ({ notifications: { ...s.notifications, list: [n, ...s.notifications.list] } }))
    return n
  },
  sendNotification: async (id) => {
    const n = await notificationsApi.sendNotification(id)
    set(s => ({
      notifications: {
        ...s.notifications,
        list: s.notifications.list.map(item => item.id === id ? n : item),
        selected: s.notifications.selected?.id === id ? n : s.notifications.selected,
      },
    }))
  },
  withdrawNotification: async (id, reason) => {
    const n = await notificationsApi.withdrawNotification(id, reason)
    set(s => ({
      notifications: {
        ...s.notifications,
        list: s.notifications.list.map(item => item.id === id ? n : item),
        selected: s.notifications.selected?.id === id ? n : s.notifications.selected,
      },
    }))
  },
  checkDuplicate: async (clientId, type, date) => {
    const res = await notificationsApi.checkDuplicate(clientId, type, date)
    set(s => ({ notifications: { ...s.notifications, duplicateWarning: res.isDuplicate ? res.existing || null : null } }))
  },
  clearDuplicateWarning: () => {
    set(s => ({ notifications: { ...s.notifications, duplicateWarning: null } }))
  },
  fetchStatusLogs: async (notificationId) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}/logs`)
      const logs = await res.json()
      set(s => ({ notifications: { ...s.notifications, statusLogs: logs } }))
    } catch {}
  },

  fetchDeposits: async () => {
    set(s => ({ deposits: { ...s.deposits, loading: true } }))
    try {
      const f = get().deposits.filters
      const res = await depositsApi.getDeposits({
        client_id: f.client_id || undefined,
        match_status: f.match_status || undefined,
        start_date: f.start_date || undefined,
        end_date: f.end_date || undefined,
        page: f.page,
        pageSize: f.pageSize,
      })
      set(s => ({ deposits: { ...s.deposits, list: res.items as Deposit[], total: res.total, loading: false } }))
    } catch {
      set(s => ({ deposits: { ...s.deposits, loading: false } }))
    }
  },
  setDepositFilters: (filters) => {
    set(s => ({ deposits: { ...s.deposits, filters: { ...s.deposits.filters, ...filters } } }))
  },
  selectDeposit: (d) => {
    set(s => ({ deposits: { ...s.deposits, selected: d } }))
  },
  createDeposit: async (data) => {
    const d = await depositsApi.createDeposit(data)
    set(s => ({ deposits: { ...s.deposits, list: [d, ...s.deposits.list] } }))
  },
  triggerAutoMatch: async () => {
    await depositsApi.triggerAutoMatch()
    await get().fetchDeposits()
  },
  manualMatch: async (depositId, notificationId, amount) => {
    await depositsApi.manualMatch(depositId, notificationId, amount)
    await get().fetchDeposits()
  },

  fetchMarket: async () => {
    set(s => ({ market: { ...s.market, loading: true } }))
    try {
      const snapshots = await marketApi.getMarketSnapshot()
      set(s => ({ market: { snapshots, loading: false } }))
    } catch {
      set(s => ({ market: { ...s.market, loading: false } }))
    }
  },

  uploadFiles: async (formData) => {
    set(s => ({ imports: { ...s.imports, loading: true } }))
    try {
      const result = await importApi.uploadFiles(formData)
      const batchObj: any = result
      const batch = {
        id: batchObj.batchId,
        file_name: '',
        file_type: 'position' as FileType,
        status: 'pending' as ImportBatchStatus,
        total_rows: batchObj.totalRows,
        success_rows: batchObj.successRows,
        error_rows: batchObj.errorRows,
        created_at: new Date().toISOString(),
      }
      set(s => ({ imports: { ...s.imports, batches: [...s.imports.batches, batch], loading: false } }))
    } catch {
      set(s => ({ imports: { ...s.imports, loading: false } }))
    }
  },
  fetchImportStatus: async (batchId) => {
    try {
      const res = await importApi.getImportStatus(batchId)
      set(s => ({ imports: { ...s.imports, currentBatch: res.batch, currentRecords: res.records } }))
    } catch {}
  },
  confirmImport: async (batchId) => {
    try {
      const result = await importApi.confirmImport(batchId)
      set(s => ({ imports: { ...s.imports, mergeResult: result } }))
    } catch {}
  },
  cancelImport: async (batchId) => {
    try {
      await importApi.cancelImport(batchId)
      set(s => ({ imports: { ...s.imports, currentBatch: null, currentRecords: [] } }))
    } catch {}
  },
  setImportTab: (tab) => {
    set(s => ({ imports: { ...s.imports, activeTab: tab } }))
  },

  fetchReports: async () => {
    set(s => ({ reports: { ...s.reports, loading: true } }))
    try {
      const f = get().reports.filters
      const res = await reportsApi.getReports({
        start_date: f.start_date || undefined,
        end_date: f.end_date || undefined,
        risk_level: f.risk_level || undefined,
        page: f.page,
        pageSize: f.pageSize,
      })
      set(s => ({ reports: { ...s.reports, list: res.items as Report[], total: res.total, loading: false } }))
    } catch {
      set(s => ({ reports: { ...s.reports, loading: false } }))
    }
  },
  fetchReport: async (id) => {
    try {
      const report = await reportsApi.getReport(id)
      set(s => ({ reports: { ...s.reports, current: report } }))
    } catch {}
  },
  generateReport: async () => {
    try {
      const f = get().reports.filters
      await reportsApi.generateReport({
        start_date: f.start_date || undefined,
        end_date: f.end_date || undefined,
        risk_level: f.risk_level || undefined,
      })
      await get().fetchReports()
    } catch {}
  },
  setReportFilters: (filters) => {
    set(s => ({ reports: { ...s.reports, filters: { ...s.reports.filters, ...filters } } }))
  },
  fetchReportHistory: async () => {
    try {
      const history = await reportsApi.getReportHistory()
      set(s => ({ reports: { ...s.reports, history } }))
    } catch {}
  },

  toggleSidebar: () => {
    set(s => ({ ui: { ...s.ui, sidebarCollapsed: !s.ui.sidebarCollapsed } }))
  },
  toggleMarketPanel: () => {
    set(s => ({ ui: { ...s.ui, marketPanelOpen: !s.ui.marketPanelOpen } }))
  },
  showConfirmModal: (title, message, onConfirm) => {
    set(s => ({ ui: { ...s.ui, confirmModal: { open: true, title, message, onConfirm } } }))
  },
  hideConfirmModal: () => {
    set(s => ({ ui: { ...s.ui, confirmModal: null } }))
  },
}))
