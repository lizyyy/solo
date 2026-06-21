import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  FilterPreset,
  ImportError,
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
  importErrors: ImportError[]
  filterPresets: FilterPreset[]

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

  saveFilterPreset: (name: string) => string
  loadFilterPreset: (id: string) => void
  deleteFilterPreset: (id: string) => void

  batchImportPoints: (newPoints: CorrosionPoint[], sourceFile: string) => { imported: number; errors: ImportError[] }
  addImportError: (error: Omit<ImportError, 'id'>) => void
  addImportErrors: (errors: Omit<ImportError, 'id'>[]) => void
  clearImportErrors: () => void
  addQCRecord: (qc: Omit<QCRecord, 'id'>) => void
}

const defaultFilters: FilterState = {
  severity: [],
  sources: [],
  dateRange: ['2026-01-01', '2026-12-31'],
  pipeIds: [],
  status: [],
}

function generateId(prefix: string, existing: string[]): string {
  let counter = existing.length + 1
  let id = `${prefix}-${String(counter).padStart(3, '0')}`
  while (existing.includes(id)) {
    counter++
    id = `${prefix}-${String(counter).padStart(3, '0')}`
  }
  return id
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      pipes: mockPipes,
      points: mockPoints,
      photos: mockPhotos,
      qcRecords: mockQCRecords,
      judgments: mockJudgments,
      conflicts: mockConflicts,
      importErrors: [],
      filterPresets: [
        {
          id: 'preset-001',
          name: '仅异常及以上',
          filters: {
            ...defaultFilters,
            severity: ['moderate', 'severe', 'critical'],
            status: ['anomaly', 'exception'],
          },
          createdAt: '2026-05-20T10:00:00',
        },
      ],

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
        set((state) => {
          const conflict = state.conflicts.find((c) => c.id === conflictId)
          if (!conflict) return state
          return {
            conflicts: state.conflicts.map((c) =>
              c.id === conflictId
                ? { ...c, resolution, resolvedBy, resolvedAt: new Date().toISOString() }
                : c
            ),
            qcRecords: state.qcRecords.map((qc) =>
              qc.issueType === 'conflict' && qc.pointId === conflict.pointId
                ? { ...qc, status: 'resolved' as const }
                : qc
            ),
          }
        }),

      addJudgment: (log) =>
        set((state) => ({
          judgments: [
            ...state.judgments,
            {
              ...log,
              id: generateId('jg', state.judgments.map((j) => j.id)),
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
            id: generateId('jg', state.judgments.map((j) => j.id)),
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

      saveFilterPreset: (name) => {
        const preset: FilterPreset = {
          id: generateId('preset', get().filterPresets.map((p) => p.id)),
          name,
          filters: JSON.parse(JSON.stringify(get().filters)),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ filterPresets: [...state.filterPresets, preset] }))
        return preset.id
      },

      loadFilterPreset: (id) => {
        const preset = get().filterPresets.find((p) => p.id === id)
        if (preset) {
          set({ filters: JSON.parse(JSON.stringify(preset.filters)) })
        }
      },

      deleteFilterPreset: (id) =>
        set((state) => ({
          filterPresets: state.filterPresets.filter((p) => p.id !== id),
        })),

      batchImportPoints: (newPoints, sourceFile) => {
        const errors: ImportError[] = []
        const imported: CorrosionPoint[] = []
        const existingIds = get().points.map((p) => p.id)
        const existingPipeIds = new Set(get().pipes.map((p) => p.id))
        const newQCRecords: QCRecord[] = []
        const detectedAt = new Date().toISOString()

        newPoints.forEach((point, idx) => {
          const rowNum = idx + 2

          if (!point.id || point.id.trim() === '') {
            errors.push({
              id: generateId('err', errors.map((e) => e.id)),
              rowNumber: rowNum,
              field: 'id',
              value: point.id,
              errorType: 'missing_field',
              message: '点位ID不能为空',
              sourceFile,
            })
            return
          }

          if (existingIds.includes(point.id) || imported.some((p) => p.id === point.id)) {
            errors.push({
              id: generateId('err', errors.map((e) => e.id)),
              rowNumber: rowNum,
              field: 'id',
              value: point.id,
              errorType: 'duplicate_id',
              message: `点位ID ${point.id} 已存在`,
              sourceFile,
            })
            return
          }

          if (!point.pipeId || !existingPipeIds.has(point.pipeId)) {
            errors.push({
              id: generateId('err', errors.map((e) => e.id)),
              rowNumber: rowNum,
              field: 'pipeId',
              value: point.pipeId,
              errorType: 'unknown_pipe',
              message: `管线ID ${point.pipeId} 不存在于系统中`,
              sourceFile,
            })
            return
          }

          if (point.depth != null && (isNaN(point.depth) || point.depth < 0 || point.depth > 20)) {
            errors.push({
              id: generateId('err', errors.map((e) => e.id)),
              rowNumber: rowNum,
              field: 'depth',
              value: String(point.depth),
              errorType: 'out_of_range',
              message: `腐蚀深度 ${point.depth}mm 超出有效范围 (0-20mm)`,
              sourceFile,
            })
            newQCRecords.push({
              id: generateId('qc', [...get().qcRecords, ...newQCRecords].map((q) => q.id)),
              pointId: point.id,
              issueType: 'out_of_range',
              description: `导入数据腐蚀深度 ${point.depth}mm 超出有效范围 (0-20mm)`,
              status: 'open',
              detectedAt,
            })
          }

          if (point.thickness != null && (isNaN(point.thickness) || point.thickness < 0 || point.thickness > 50)) {
            errors.push({
              id: generateId('err', errors.map((e) => e.id)),
              rowNumber: rowNum,
              field: 'thickness',
              value: String(point.thickness),
              errorType: 'out_of_range',
              message: `壁厚 ${point.thickness}mm 超出有效范围 (0-50mm)`,
              sourceFile,
            })
            newQCRecords.push({
              id: generateId('qc', [...get().qcRecords, ...newQCRecords].map((q) => q.id)),
              pointId: point.id,
              issueType: 'out_of_range',
              description: `导入数据壁厚 ${point.thickness}mm 超出有效范围 (0-50mm)`,
              status: 'open',
              detectedAt,
            })
          }

          if (point.depth == null || point.thickness == null) {
            const missingFields = []
            if (point.depth == null) missingFields.push('depth')
            if (point.thickness == null) missingFields.push('thickness')
            newQCRecords.push({
              id: generateId('qc', [...get().qcRecords, ...newQCRecords].map((q) => q.id)),
              pointId: point.id,
              issueType: 'null_value',
              description: `字段 ${missingFields.join(', ')} 为空值，无法完整评估腐蚀状态`,
              status: 'open',
              detectedAt,
            })
          }

          imported.push(point)
        })

        set((state) => ({
          points: [...state.points, ...imported],
          importErrors: [...state.importErrors, ...errors],
          qcRecords: [...state.qcRecords, ...newQCRecords],
        }))

        return { imported: imported.length, errors }
      },

      addImportError: (error) =>
        set((state) => ({
          importErrors: [
            ...state.importErrors,
            { ...error, id: generateId('err', state.importErrors.map((e) => e.id)) },
          ],
        })),

      addImportErrors: (errors) =>
        set((state) => {
          const newErrors: ImportError[] = []
          let currentIds = state.importErrors.map((e) => e.id)
          errors.forEach((err) => {
            const id = generateId('err', currentIds)
            newErrors.push({ ...err, id })
            currentIds.push(id)
          })
          return { importErrors: [...state.importErrors, ...newErrors] }
        }),

      clearImportErrors: () => set({ importErrors: [] }),

      addQCRecord: (qc) =>
        set((state) => ({
          qcRecords: [
            ...state.qcRecords,
            { ...qc, id: generateId('qc', state.qcRecords.map((q) => q.id)) },
          ],
        })),
    }),
    {
      name: 'corrosion-map-storage',
      partialize: (state) => ({
        points: state.points,
        judgments: state.judgments,
        qcRecords: state.qcRecords,
        conflicts: state.conflicts,
        filterPresets: state.filterPresets,
        importErrors: state.importErrors,
      }),
    }
  )
)
