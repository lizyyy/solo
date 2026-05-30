import { create } from 'zustand'
import type {
  ProjectData,
  SurfaceConfig,
  VectorFieldConfig,
  SkiPath,
  Note,
  TeacherAnnotation,
  AnomalyEntry,
  ViewState,
  ViewMode,
} from '@/types'
import {
  DEFAULT_SURFACE,
  DEFAULT_VECTOR_FIELD,
  DEFAULT_VIEW_STATE,
} from '@/types'
import { generateSkiPath } from '@/utils/gradient'
import { createAnomalyEntry } from '@/utils/anomaly'
import { saveProject, loadLatestProject } from '@/utils/storage'

interface ClassroomState {
  project: ProjectData
  isLoaded: boolean
  gradientField: { x: number; y: number; z: number; dx: number; dy: number; magnitude: number }[]

  loadFromStorage: () => Promise<void>
  setSurface: (surface: Partial<SurfaceConfig>) => void
  setVectorField: (vf: Partial<VectorFieldConfig>) => void
  setViewState: (vs: Partial<ViewState>) => void
  setActiveView: (view: ViewMode) => void
  addPath: (startPoint: [number, number], stepSize: number, maxSteps: number) => string
  removePath: (id: string) => void
  addNote: (pathId: string | null, content: string) => void
  updateNote: (id: string, content: string) => void
  removeNote: (id: string) => void
  addTeacherAnnotation: (pathId: string | null, content: string, tags: ('重点' | '易错' | '注意')[]) => void
  updateTeacherAnnotation: (id: string, content: string, tags: ('重点' | '易错' | '注意')[]) => void
  removeTeacherAnnotation: (id: string) => void
  setGradientField: (field: { x: number; y: number; z: number; dx: number; dy: number; magnitude: number }[]) => void
  persist: () => Promise<void>
  exportProjectJSON: () => string
}

function createDefaultProject(): ProjectData {
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '向量场滑雪课堂',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    surface: { ...DEFAULT_SURFACE },
    vectorField: { ...DEFAULT_VECTOR_FIELD },
    paths: [],
    notes: [],
    teacherAnnotations: [],
    anomalyLog: [],
    viewState: { ...DEFAULT_VIEW_STATE },
  }
}

export const useClassroomStore = create<ClassroomState>((set, get) => ({
  project: createDefaultProject(),
  isLoaded: false,
  gradientField: [],

  loadFromStorage: async () => {
    try {
      const saved = await loadLatestProject()
      if (saved) {
        set({ project: saved, isLoaded: true })
      } else {
        set({ isLoaded: true })
      }
    } catch {
      set({ isLoaded: true })
    }
  },

  setSurface: (surface) => {
    set((state) => ({
      project: {
        ...state.project,
        surface: { ...state.project.surface, ...surface },
      },
    }))
    get().persist()
  },

  setVectorField: (vf) => {
    set((state) => ({
      project: {
        ...state.project,
        vectorField: { ...state.project.vectorField, ...vf },
      },
    }))
    get().persist()
  },

  setViewState: (vs) => {
    set((state) => ({
      project: {
        ...state.project,
        viewState: { ...state.project.viewState, ...vs },
      },
    }))
    get().persist()
  },

  setActiveView: (view) => {
    set((state) => ({
      project: {
        ...state.project,
        viewState: { ...state.project.viewState, activeView: view },
      },
    }))
    get().persist()
  },

  addPath: (startPoint, stepSize, maxSteps) => {
    const { project } = get()
    const result = generateSkiPath(project.surface, startPoint, stepSize, maxSteps)
    const pathId = `path_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const newPath: SkiPath = {
      id: pathId,
      startPoint,
      stepSize,
      maxSteps,
      points: result.points,
      createdAt: Date.now(),
    }

    const newAnomalies: AnomalyEntry[] = result.anomalies.map((a) =>
      createAnomalyEntry(a.type, pathId, a.stepIndex)
    )

    set((state) => ({
      project: {
        ...state.project,
        paths: [...state.project.paths, newPath],
        anomalyLog: [...state.project.anomalyLog, ...newAnomalies],
      },
    }))
    get().persist()
    return pathId
  },

  removePath: (id) => {
    set((state) => ({
      project: {
        ...state.project,
        paths: state.project.paths.filter((p) => p.id !== id),
        notes: state.project.notes.filter((n) => n.pathId !== id),
        teacherAnnotations: state.project.teacherAnnotations.filter((a) => a.pathId !== id),
      },
    }))
    get().persist()
  },

  addNote: (pathId, content) => {
    const note: Note = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      pathId,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({
      project: {
        ...state.project,
        notes: [...state.project.notes, note],
      },
    }))
    get().persist()
  },

  updateNote: (id, content) => {
    set((state) => ({
      project: {
        ...state.project,
        notes: state.project.notes.map((n) =>
          n.id === id ? { ...n, content, updatedAt: Date.now() } : n
        ),
      },
    }))
    get().persist()
  },

  removeNote: (id) => {
    set((state) => ({
      project: {
        ...state.project,
        notes: state.project.notes.filter((n) => n.id !== id),
      },
    }))
    get().persist()
  },

  addTeacherAnnotation: (pathId, content, tags) => {
    const annotation: TeacherAnnotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      pathId,
      content,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({
      project: {
        ...state.project,
        teacherAnnotations: [...state.project.teacherAnnotations, annotation],
      },
    }))
    get().persist()
  },

  updateTeacherAnnotation: (id, content, tags) => {
    set((state) => ({
      project: {
        ...state.project,
        teacherAnnotations: state.project.teacherAnnotations.map((a) =>
          a.id === id ? { ...a, content, tags, updatedAt: Date.now() } : a
        ),
      },
    }))
    get().persist()
  },

  removeTeacherAnnotation: (id) => {
    set((state) => ({
      project: {
        ...state.project,
        teacherAnnotations: state.project.teacherAnnotations.filter((a) => a.id !== id),
      },
    }))
    get().persist()
  },

  setGradientField: (field) => {
    set({ gradientField: field })
  },

  persist: async () => {
    try {
      const { project } = get()
      await saveProject(project)
    } catch (e) {
      console.error('Failed to persist project:', e)
    }
  },

  exportProjectJSON: () => {
    const { project } = get()
    return JSON.stringify(project, null, 2)
  },
}))
