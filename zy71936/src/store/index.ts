import { create } from "zustand"
import type { Project, PhotoRecord, ChangeLog, ExportSpec, MarkStatus, SourceType, AuthStatus } from "@/lib/types"
import * as dbOps from "@/lib/db"
import { db } from "@/lib/db"
import { judgeRecords } from "@/lib/judge"

interface AppState {
  currentProject: Project | null
  projects: Project[]
  photoRecords: PhotoRecord[]
  changeLogs: ChangeLog[]
  exportSpecs: ExportSpec[]
  selectedRecordId: string | null
  filterStatus: MarkStatus | "全部"
  filterSourceType: SourceType | "全部"
  filterAuthStatus: AuthStatus | "全部"
  searchQuery: string
  loading: boolean

  setCurrentProject: (project: Project | null) => void
  loadProjects: () => Promise<void>
  createProject: (name: string, specVersion: string) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  loadPhotoRecords: (projectId?: string) => Promise<void>
  addPhotoRecords: (records: PhotoRecord[], projectSpecVersion: string) => Promise<void>
  updatePhotoRecord: (
    id: string,
    changes: Partial<PhotoRecord>,
    changedBy: string,
    changeReason: string
  ) => Promise<void>
  confirmRecords: (ids: string[]) => Promise<void>
  setSelectedRecordId: (id: string | null) => void
  setFilterStatus: (status: MarkStatus | "全部") => void
  setFilterSourceType: (source: SourceType | "全部") => void
  setFilterAuthStatus: (auth: AuthStatus | "全部") => void
  setSearchQuery: (query: string) => void
  loadChangeLogs: (recordId?: string) => Promise<void>
  loadExportSpecs: () => Promise<void>
  saveExportSpec: (spec: ExportSpec) => Promise<void>
  deleteRecord: (id: string) => Promise<void>
  rejudgeRecords: (projectSpecVersion: string) => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  currentProject: null,
  projects: [],
  photoRecords: [],
  changeLogs: [],
  exportSpecs: [],
  selectedRecordId: null,
  filterStatus: "全部",
  filterSourceType: "全部",
  filterAuthStatus: "全部",
  searchQuery: "",
  loading: false,

  setCurrentProject: (project) => set({ currentProject: project }),

  loadProjects: async () => {
    const projects = await dbOps.getAllProjects()
    set({ projects })
  },

  createProject: async (name, specVersion) => {
    const project = await dbOps.createProject(name, specVersion)
    set((state) => ({ projects: [...state.projects, project], currentProject: project }))
    return project
  },

  deleteProject: async (id) => {
    await dbOps.deleteProject(id)
    const { currentProject } = get()
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: currentProject?.id === id ? null : currentProject,
      photoRecords: currentProject?.id === id ? [] : state.photoRecords,
    }))
  },

  loadPhotoRecords: async (projectId) => {
    set({ loading: true })
    const records = projectId
      ? await dbOps.getPhotoRecordsByProject(projectId)
      : await dbOps.getAllPhotoRecords()
    set({ photoRecords: records, loading: false })
  },

  addPhotoRecords: async (records, projectSpecVersion) => {
    const judged = judgeRecords(records, projectSpecVersion)
    await dbOps.addPhotoRecords(judged)
    set((state) => ({ photoRecords: [...state.photoRecords, ...judged] }))
  },

  updatePhotoRecord: async (id, changes, changedBy, changeReason) => {
    const existing = await db.photoRecords.get(id)
    if (!existing) return

    const logEntries: ChangeLog[] = []
    for (const [field, newValue] of Object.entries(changes)) {
      const oldValue = String((existing as unknown as Record<string, unknown>)[field] ?? "")
      if (oldValue !== String(newValue)) {
        logEntries.push({
          id: crypto.randomUUID(),
          photoRecordId: id,
          field,
          oldValue,
          newValue: String(newValue),
          changedBy,
          changedAt: Date.now(),
          changeReason,
        })
      }
    }

    await dbOps.updatePhotoRecord(id, changes)
    for (const log of logEntries) {
      await dbOps.addChangeLog(log)
    }

    set((state) => ({
      photoRecords: state.photoRecords.map((r) => (r.id === id ? { ...r, ...changes, updatedAt: Date.now() } : r)),
      changeLogs: [...logEntries, ...state.changeLogs],
    }))
  },

  confirmRecords: async (ids) => {
    for (const id of ids) {
      await dbOps.updatePhotoRecord(id, { markStatus: "已确认" })
    }
    set((state) => ({
      photoRecords: state.photoRecords.map((r) =>
        ids.includes(r.id) ? { ...r, markStatus: "已确认" as MarkStatus, updatedAt: Date.now() } : r
      ),
    }))
  },

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterSourceType: (source) => set({ filterSourceType: source }),
  setFilterAuthStatus: (auth) => set({ filterAuthStatus: auth }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  loadChangeLogs: async (recordId) => {
    const logs = recordId
      ? await dbOps.getChangeLogsByRecord(recordId)
      : await dbOps.getAllChangeLogs()
    set({ changeLogs: logs })
  },

  loadExportSpecs: async () => {
    const specs = await dbOps.getAllExportSpecs()
    set({ exportSpecs: specs })
  },

  saveExportSpec: async (spec) => {
    const existing = await db.exportSpecs.get(spec.id)
    if (existing) {
      await dbOps.updateExportSpec(spec.id, { ...spec, lastUsedAt: Date.now() })
    } else {
      await dbOps.addExportSpec(spec)
    }
    set((state) => ({
      exportSpecs: state.exportSpecs.some((s) => s.id === spec.id)
        ? state.exportSpecs.map((s) => (s.id === spec.id ? { ...spec, lastUsedAt: Date.now() } : s))
        : [...state.exportSpecs, { ...spec, lastUsedAt: Date.now() }],
    }))
  },

  deleteRecord: async (id) => {
    await dbOps.deletePhotoRecord(id)
    set((state) => ({
      photoRecords: state.photoRecords.filter((r) => r.id !== id),
      changeLogs: state.changeLogs.filter((l) => l.photoRecordId !== id),
    }))
  },

  rejudgeRecords: async (projectSpecVersion) => {
    const { photoRecords } = get()
    const rejudged = judgeRecords(photoRecords, projectSpecVersion)
    for (const record of rejudged) {
      await dbOps.updatePhotoRecord(record.id, {
        markStatus: record.markStatus,
        markReason: record.markReason,
        nextStep: record.nextStep,
      })
    }
    set({ photoRecords: rejudged })
  },
}))
