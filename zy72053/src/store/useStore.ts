import { create } from 'zustand'
import type {
  CorrosionPoint,
  InspectionPhoto,
  QCRecord,
  JudgmentLog,
  ConflictRecord,
  PipeSegment,
  FilterState,
  Severity,
  PointStatus,
} from '@/types'
import {
  mockPipes,
  mockPoints,
  mockPhotos,
  mockQCRecords,
  mockJudgments,
  mockConflicts,
} from '@/data/mockData'

interface AppState {
  pipes: PipeSegment[]
  points: CorrosionPoint[]
  photos: InspectionPhoto[]
  qcRecords: QCRecord[]
  judgments: JudgmentLog[]
  conflicts: ConflictRecord[]

  filters: FilterState
  selectedPointId: string | null
  sidebarOpen: boolean

  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  selectPoint: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void

  resolveConflict: (conflictId: string, resolution: ConflictRecord['resolution'], resolvedBy: string) => void
  addJudgment: (log: Omit<JudgmentLog, 'id' | 'createdAt'>) => void
  resolveQC: (qcId: string) => void
  correctPointData: (pointId: string, field: string, oldValue: string, newValue: string, reason: string) => void

  getPointById: (id: string) => CorrosionPoint | undefined
  getPhotosByPointId: (id: string) => InspectionPhoto[]
  getQCByPointId: (id: string) => QCRecord[]
  getJudgmentsByPointId: (id: string) => JudgmentLog[]
  getConflictByPointId: (id: string) => ConflictRecord | undefined
  getPipeById: (id: string) => PipeSegment | undefined
}

const defaultFilters: FilterState = {
  severity: [],
  sources: [],
  dateRange: ['2026-01-01', '2026-12-31'],
  pipeIds: [],
  status: [],
}

export const useStore = create<AppState>((set, get) => ({
  pipes: mockPipes,
  points: mockPoints,
  photos: mockPhotos,
  qcRecords: mockQCRecords,
  judgments: mockJudgments,
  conflicts: mockConflicts,

  filters: { ...defaultFilters },
  selectedPointId: null,
  sidebarOpen: true,

  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  selectPoint: (id) => set({ selectedPointId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  resolveConflict: (conflictId, resolution, resolvedBy) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolution, resolvedBy, resolvedAt: new Date().toISOString() }
          : c
      ),
      qcRecords: state.qcRecords.map((qc) =>
        qc.issueType === 'conflict' && qc.pointId === state.conflicts.find((c) => c.id === conflictId)?.pointId
          ? { ...qc, status: 'resolved' as const }
          : qc
      ),
    })),

  addJudgment: (log) =>
    set((state) => ({
      judgments: [
        ...state.judgments,
        {
          ...log,
          id: `jg-${String(state.judgments.length + 1).padStart(3, '0')}`,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  resolveQC: (qcId) =>
    set((state) => ({
      qcRecords: state.qcRecords.map((qc) =>
        qc.id === qcId ? { ...qc, status: 'resolved' as const } : qc
      ),
    })),

  correctPointData: (pointId, field, oldValue, newValue, reason) =>
    set((state) => {
      const updatedPoints = state.points.map((p) => {
        if (p.id !== pointId) return p
        const updated = { ...p }
        if (field === 'depth') updated.depth = parseFloat(newValue)
        else if (field === 'thickness') updated.thickness = parseFloat(newValue)
        else if (field === 'severity') updated.severity = newValue as Severity
        else if (field === 'status') updated.status = newValue as PointStatus
        return updated
      })
      const newJudgment: JudgmentLog = {
        id: `jg-${String(state.judgments.length + 1).padStart(3, '0')}`,
        pointId,
        operator: '当前用户',
        judgmentType: 'data_correction',
        oldValue,
        newValue,
        reason,
        createdAt: new Date().toISOString(),
      }
      return { points: updatedPoints, judgments: [...state.judgments, newJudgment] }
    }),

  getPointById: (id) => get().points.find((p) => p.id === id),
  getPhotosByPointId: (id) => get().photos.filter((p) => p.pointId === id),
  getQCByPointId: (id) => get().qcRecords.filter((q) => q.pointId === id),
  getJudgmentsByPointId: (id) => get().judgments.filter((j) => j.pointId === id),
  getConflictByPointId: (id) => get().conflicts.find((c) => c.pointId === id),
  getPipeById: (id) => get().pipes.find((p) => p.id === id),
}))
