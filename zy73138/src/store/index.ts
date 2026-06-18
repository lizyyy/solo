import { create } from 'zustand'
import type { SampleRecord, DataSourceEntry, ChangeRecord, ReviewFlag, HandoverItem, LogbookEntry, AlignmentStatus, HandoverStatus, ReviewStatus } from '@/types'
import { sampleRecords, dataSources, changeRecords, reviewFlags, handoverItems, logbookEntries } from '@/data'

interface WaterQualityStore {
  records: SampleRecord[]
  dataSources: DataSourceEntry[]
  changes: ChangeRecord[]
  reviews: ReviewFlag[]
  handovers: HandoverItem[]
  logbooks: LogbookEntry[]
  selectedRecordId: string | null
  filterStation: string
  filterAnomaly: string
  filterSourceType: string

  setSelectedRecord: (id: string | null) => void
  setFilterStation: (v: string) => void
  setFilterAnomaly: (v: string) => void
  setFilterSourceType: (v: string) => void

  updateReviewStatus: (reviewId: string, status: ReviewStatus, note: string) => void
  updateHandoverItem: (itemId: string, alignment: AlignmentStatus, handover: HandoverStatus) => void
  completeHandover: (itemId: string) => void

  getDataSourcesForRecord: (recordId: string) => DataSourceEntry[]
  getChangesForRecord: (recordId: string) => ChangeRecord[]
  getReviewForRecord: (recordId: string) => ReviewFlag | undefined
  getHandoverForRecord: (recordId: string) => HandoverItem | undefined
  getLogbookForRecord: (recordId: string) => LogbookEntry[]
  getDuplicateRecords: (bottleNumber: string) => SampleRecord[]
  getFilteredRecords: () => SampleRecord[]
}

export const useWaterQualityStore = create<WaterQualityStore>((set, get) => ({
  records: sampleRecords,
  dataSources,
  changes: changeRecords,
  reviews: reviewFlags,
  handovers: handoverItems,
  logbooks: logbookEntries,
  selectedRecordId: null,
  filterStation: '',
  filterAnomaly: '',
  filterSourceType: '',

  setSelectedRecord: (id) => set({ selectedRecordId: id }),
  setFilterStation: (v) => set({ filterStation: v }),
  setFilterAnomaly: (v) => set({ filterAnomaly: v }),
  setFilterSourceType: (v) => set({ filterSourceType: v }),

  updateReviewStatus: (reviewId, status, note) =>
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === reviewId ? { ...r, reviewStatus: status, reviewerNote: note } : r
      ),
    })),

  updateHandoverItem: (itemId, alignment, handover) =>
    set((state) => ({
      handovers: state.handovers.map((h) =>
        h.id === itemId
          ? { ...h, alignmentStatus: alignment, handoverStatus: handover }
          : h
      ),
    })),

  completeHandover: (itemId) =>
    set((state) => ({
      handovers: state.handovers.map((h) =>
        h.id === itemId
          ? { ...h, handoverStatus: 'completed' as HandoverStatus, handoverTime: new Date().toISOString(), handoverBy: '阿宁' }
          : h
      ),
    })),

  getDataSourcesForRecord: (recordId) =>
    get().dataSources.filter((ds) => ds.recordId === recordId),

  getChangesForRecord: (recordId) =>
    get().changes.filter((c) => c.recordId === recordId),

  getReviewForRecord: (recordId) =>
    get().reviews.find((r) => r.recordId === recordId),

  getHandoverForRecord: (recordId) =>
    get().handovers.find((h) => h.recordId === recordId),

  getLogbookForRecord: (recordId) =>
    get().logbooks.filter((lb) => lb.relatedRecordIds.includes(recordId)),

  getDuplicateRecords: (bottleNumber) =>
    get().records.filter((r) => r.bottleNumber === bottleNumber),

  getFilteredRecords: () => {
    const { records, filterStation, filterAnomaly, filterSourceType, dataSources } = get()
    let filtered = records
    if (filterStation) {
      filtered = filtered.filter((r) => r.stationName.includes(filterStation))
    }
    if (filterAnomaly === 'anomaly') {
      filtered = filtered.filter((r) => r.isAnomaly)
    } else if (filterAnomaly === 'normal') {
      filtered = filtered.filter((r) => !r.isAnomaly)
    }
    if (filterSourceType) {
      const recordIds = new Set(
        dataSources.filter((ds) => ds.sourceType === filterSourceType).map((ds) => ds.recordId)
      )
      filtered = filtered.filter((r) => recordIds.has(r.id))
    }
    return filtered
  },
}))
