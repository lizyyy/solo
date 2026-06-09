import { create } from 'zustand'
import { fetchReport } from '@/api'

export interface RecordDetail {
  id: string
  sensorId: string
  originalLineNo: number
  temperatureValue: number
  temperatureUnit: 'C' | 'K'
  correctedValue: number | null
  correctedUnit: 'C' | 'K' | null
  status: 'normal' | 'mixed_unit' | 'anomaly' | 'confirmed' | 'rolled_back'
  credibility: 'sensor_trusted' | 'photo_trusted' | 'pending_confirmation' | null
  source: 'sensor_original' | 'photo_corrected' | 'coach_confirmed' | 'rolled_back'
  note: string | null
  batchId: string
  createdAt: string
  updatedAt: string
}

export interface AuditLogEntry {
  id: string
  recordId: string
  action: 'import' | 'review' | 'confirm' | 'rollback' | 'edit'
  operatorRole: string
  oldValue: string | null
  newValue: string | null
  note: string | null
  createdAt: string
}

export interface PhotoEntry {
  id: string
  recordId: string
  filePath: string
  description: string | null
  uploadedAt: string
}

export interface ReportSummary {
  totalRecords: number
  normalCount: number
  mixedCount: number
  pendingCount: number
  confirmedCount: number
  rolledBackCount: number
}

export interface ReportGroup {
  sensorId: string
  records: RecordDetail[]
}

interface AppState {
  currentRole: 'engineer' | 'maintenance_worker' | 'training_coach'
  setCurrentRole: (role: AppState['currentRole']) => void

  records: RecordDetail[]
  recordsTotal: number
  recordsLoading: boolean
  recordsPage: number
  recordsPageSize: number
  recordsFilter: { status?: string; sensorId?: string }
  setRecords: (records: RecordDetail[], total: number) => void
  setRecordsLoading: (loading: boolean) => void
  setRecordsPage: (page: number) => void
  setRecordsFilter: (filter: AppState['recordsFilter']) => void
  updateRecord: (record: RecordDetail) => Promise<void>

  selectedRecord: RecordDetail | null
  setSelectedRecord: (record: RecordDetail | null) => void

  auditLogs: AuditLogEntry[]
  setAuditLogs: (logs: AuditLogEntry[]) => void

  photos: PhotoEntry[]
  setPhotos: (photos: PhotoEntry[]) => void

  reportSummary: ReportSummary | null
  reportGroups: ReportGroup[]
  setReport: (summary: ReportSummary, groups: ReportGroup[]) => void
  refreshReport: () => Promise<void>

  importResult: { imported: number; mixed: number; normal: number } | null
  setImportResult: (result: AppState['importResult']) => void
}

export const useStore = create<AppState>((set, get) => ({
  currentRole: 'training_coach',
  setCurrentRole: (role) => set({ currentRole: role }),

  records: [],
  recordsTotal: 0,
  recordsLoading: false,
  recordsPage: 1,
  recordsPageSize: 50,
  recordsFilter: {},
  setRecords: (records, total) => set({ records, recordsTotal: total, recordsLoading: false }),
  setRecordsLoading: (loading) => set({ recordsLoading: loading }),
  setRecordsPage: (page) => set({ recordsPage: page }),
  setRecordsFilter: (filter) => set({ recordsFilter: filter, recordsPage: 1 }),
  updateRecord: async (record) => {
    const state = get()
    const updatedRecords = state.records.map((r) =>
      r.id === record.id ? record : r
    )
    const updatedSelected = state.selectedRecord?.id === record.id ? record : state.selectedRecord

    const updatedGroups = state.reportGroups.map((g) =>
      g.records.some((r) => r.id === record.id)
        ? { ...g, records: g.records.map((r) => (r.id === record.id ? record : r)) }
        : g
    )

    let updatedSummary = state.reportSummary
    try {
      const fresh = await fetchReport()
      updatedSummary = fresh.summary
    } catch (_e) {}

    set({
      records: updatedRecords,
      selectedRecord: updatedSelected,
      reportGroups: updatedGroups,
      reportSummary: updatedSummary,
    })
  },

  selectedRecord: null,
  setSelectedRecord: (record) => set({ selectedRecord: record }),

  auditLogs: [],
  setAuditLogs: (logs) => set({ auditLogs: logs }),

  photos: [],
  setPhotos: (photos) => set({ photos: photos }),

  reportSummary: null,
  reportGroups: [],
  setReport: (summary, groups) => set({ reportSummary: summary, reportGroups: groups }),
  refreshReport: async () => {
    try {
      const result = await fetchReport()
      set({ reportSummary: result.summary, reportGroups: result.groups })
    } catch (e) {
      console.error('Failed to refresh report:', e)
    }
  },

  importResult: null,
  setImportResult: (result) => set({ importResult: result }),
}))
