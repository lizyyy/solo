import { create } from 'zustand'
import type { InspectionPoint, ProcessingRecord, Complaint, PointStatus } from '@/types'
import { inspectionPoints as initPoints, processingRecords as initRecords, complaints as initComplaints } from '@/data/mockData'

interface StoreState {
  points: InspectionPoint[]
  records: ProcessingRecord[]
  complaints: Complaint[]
  selectedPointId: string | null
  detailOpen: boolean
  statusFilter: PointStatus | 'all'
  searchQuery: string

  selectPoint: (id: string | null) => void
  setDetailOpen: (open: boolean) => void
  setStatusFilter: (filter: PointStatus | 'all') => void
  setSearchQuery: (query: string) => void
  updatePointStatus: (pointId: string, status: PointStatus, opinion: string) => void

  getPointById: (id: string) => InspectionPoint | undefined
  getRecordsByPointId: (pointId: string) => ProcessingRecord[]
  getComplaintsByPointId: (pointId: string) => Complaint[]
  getFilteredPoints: () => InspectionPoint[]
}

export const useStore = create<StoreState>((set, get) => ({
  points: initPoints,
  records: initRecords,
  complaints: initComplaints,
  selectedPointId: null,
  detailOpen: false,
  statusFilter: 'all',
  searchQuery: '',

  selectPoint: (id) => set({ selectedPointId: id, detailOpen: id !== null }),
  setDetailOpen: (open) => set({ detailOpen: open, selectedPointId: open ? get().selectedPointId : null }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  updatePointStatus: (pointId, status, opinion) =>
    set((state) => {
      const newRecord: ProcessingRecord = {
        id: `R${Date.now()}`,
        pointId,
        action: status === 'completed' ? '标记已处理' : status === 'pending_verify' ? '标记待核实' : '标记需现场复看',
        operator: '何工',
        date: new Date().toISOString().slice(0, 10),
        oldPlan: '',
        newPlan: '',
        opinion,
        isOverride: false,
      }
      return {
        points: state.points.map((p) => (p.id === pointId ? { ...p, status } : p)),
        records: [...state.records, newRecord],
      }
    }),

  getPointById: (id) => get().points.find((p) => p.id === id),
  getRecordsByPointId: (pointId) => get().records.filter((r) => r.pointId === pointId).sort((a, b) => a.date.localeCompare(b.date)),
  getComplaintsByPointId: (pointId) => get().complaints.filter((c) => c.pointId === pointId),
  getFilteredPoints: () => {
    const { points, statusFilter, searchQuery } = get()
    return points.filter((p) => {
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      const matchSearch =
        !searchQuery ||
        p.intersectionName.includes(searchQuery) ||
        p.intersectionCode.includes(searchQuery) ||
        p.id.includes(searchQuery) ||
        p.description.includes(searchQuery)
      return matchStatus && matchSearch
    })
  },
}))
