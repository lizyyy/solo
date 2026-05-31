import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { InspectionRecord, InspectionSummary, FilterType } from '@/types'
import { mockRecords } from '@/data/mockData'

interface InspectionState {
  records: InspectionRecord[]
  filter: FilterType
  expandedId: string | null
  ledgerExportFormat: 'json' | 'csv'
  showExportModal: boolean
  showReviewModal: boolean
  reviewPassed: boolean

  setFilter: (filter: FilterType) => void
  toggleExpand: (id: string) => void
  confirmRecord: (id: string) => void
  runInspection: () => void
  setShowExportModal: (show: boolean) => void
  setShowReviewModal: (show: boolean) => void
  setReviewPassed: (passed: boolean) => void
  setLedgerExportFormat: (format: 'json' | 'csv') => void
  exportData: () => string
  getSummary: () => InspectionSummary
  getFilteredRecords: () => InspectionRecord[]
  getLedgerRecords: (status: InspectionRecord['status']) => InspectionRecord[]
}

export const useInspectionStore = create<InspectionState>()(
  persist(
    (set, get) => ({
      records: mockRecords,
      filter: 'all',
      expandedId: null,
      ledgerExportFormat: 'json',
      showExportModal: false,
      showReviewModal: false,
      reviewPassed: false,

      setFilter: (filter) => set({ filter }),

      toggleExpand: (id) =>
        set((state) => ({
          expandedId: state.expandedId === id ? null : id,
        })),

      confirmRecord: (id) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'confirmed' as const,
                  category: 'confirmed' as const,
                  confirmedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                }
              : r
          ),
        })),

      runInspection: () => {
        set({ records: mockRecords, expandedId: null, reviewPassed: false })
      },

      setShowExportModal: (show) => set({ showExportModal: show }),
      setShowReviewModal: (show) => set({ showReviewModal: show }),
      setReviewPassed: (passed) => set({ reviewPassed: passed }),
      setLedgerExportFormat: (format) => set({ ledgerExportFormat: format }),

      exportData: () => {
        const { records, ledgerExportFormat, reviewPassed } = get()
        if (!reviewPassed) return ''

        if (ledgerExportFormat === 'json') {
          return JSON.stringify(records, null, 2)
        }

        const headers = [
          'ID', '链接名称', '链接地址', '分类', '状态',
          '判断理由', '下一步', '处理口径', '巡检时间', '确认时间',
        ]
        const rows = records.map((r) => [
          r.id, r.linkName, r.linkUrl, r.category, r.status,
          r.judgmentReason, r.nextStep, r.processingStandard,
          r.inspectedAt, r.confirmedAt || '',
        ])
        return [headers.join(','), ...rows.map((row) => row.map((c) => `"${c}"`).join(','))].join('\n')
      },

      getSummary: () => {
        const { records } = get()
        const confirmed = records.filter((r) => r.status === 'confirmed')
        const pending = records.filter((r) => r.status === 'pending_supplement')
        const manual = records.filter((r) => r.status === 'manually_modified')
        return {
          total: records.length,
          autoJudged: records.filter((r) => r.status === 'confirmed' && r.confirmedAt).length,
          pendingManual: pending.length + manual.length,
          confirmed: confirmed.length,
          pendingSupplement: pending.length,
          manuallyModified: manual.length,
        }
      },

      getFilteredRecords: () => {
        const { records, filter } = get()
        if (filter === 'all') return records
        return records.filter((r) => r.category === filter)
      },

      getLedgerRecords: (status) => {
        const { records } = get()
        return records.filter((r) => r.status === status)
      },
    }),
    {
      name: 'doc-link-inspection',
      partialize: (state) => ({
        records: state.records,
      }),
    }
  )
)
