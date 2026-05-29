import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Project,
  BeatMarker,
  CutPoint,
  FormationNote,
  StudentVersion,
  RehearsalReport,
  VersionSnapshot,
  OperationHistory,
  ConflictItem,
  AudioFile,
  ConfirmStatus,
} from '@/types'

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

interface AppState {
  projects: Project[]
  audioFiles: AudioFile[]
  beatMarkers: BeatMarker[]
  cutPoints: CutPoint[]
  formationNotes: FormationNote[]
  studentVersions: StudentVersion[]
  rehearsalReports: RehearsalReport[]
  versionSnapshots: VersionSnapshot[]
  operationHistory: OperationHistory[]
  conflicts: ConflictItem[]

  addProject: (name: string, description: string) => string
  updateProject: (id: string, data: Partial<Project>) => void
  deleteProject: (id: string) => void

  addAudioFile: (projectId: string, fileName: string, duration: number, sampleRate: number) => string
  updateAudioFileStatus: (id: string, status: ConfirmStatus) => void

  addBeatMarker: (projectId: string, timeSeconds: number, beatNumber: number, bpm: number) => string
  updateBeatMarker: (id: string, data: Partial<BeatMarker>) => void
  deleteBeatMarker: (id: string) => void
  confirmBeatMarker: (id: string) => void

  addCutPoint: (projectId: string, startTime: number, endTime: number, label: string) => string
  updateCutPoint: (id: string, data: Partial<CutPoint>) => void
  deleteCutPoint: (id: string) => void
  confirmCutPoint: (id: string) => void

  addFormationNote: (projectId: string, startTime: number, endTime: number, description: string) => string
  updateFormationNote: (id: string, data: Partial<FormationNote>) => void
  deleteFormationNote: (id: string) => void
  confirmFormationNote: (id: string) => void

  addStudentVersion: (projectId: string, versionName: string) => string
  confirmStudentVersion: (id: string) => void

  addRehearsalReport: (projectId: string, title: string, content: string) => string
  confirmRehearsalReport: (id: string) => void

  createVersionSnapshot: (projectId: string, label: string) => string

  addOperation: (projectId: string, operationType: string, targetType: string, targetId: string, detail: string) => void

  detectConflicts: (projectId: string) => void
  clearConflicts: (projectId: string) => void

  generateBeatMarkers: (projectId: string, bpm: number, duration: number) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      audioFiles: [],
      beatMarkers: [],
      cutPoints: [],
      formationNotes: [],
      studentVersions: [],
      rehearsalReports: [],
      versionSnapshots: [],
      operationHistory: [],
      conflicts: [],

      addProject: (name, description) => {
        const id = genId()
        const now = Date.now()
        set((s) => ({
          projects: [...s.projects, { id, name, description, createdAt: now, updatedAt: now }],
        }))
        return id
      },

      updateProject: (id, data) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
          ),
        }))
      },

      deleteProject: (id) => {
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          audioFiles: s.audioFiles.filter((a) => a.projectId !== id),
          beatMarkers: s.beatMarkers.filter((b) => b.projectId !== id),
          cutPoints: s.cutPoints.filter((c) => c.projectId !== id),
          formationNotes: s.formationNotes.filter((f) => f.projectId !== id),
          studentVersions: s.studentVersions.filter((v) => v.projectId !== id),
          rehearsalReports: s.rehearsalReports.filter((r) => r.projectId !== id),
          versionSnapshots: s.versionSnapshots.filter((v) => v.projectId !== id),
          operationHistory: s.operationHistory.filter((o) => o.projectId !== id),
          conflicts: s.conflicts.filter((c) => c.projectId !== id),
        }))
      },

      addAudioFile: (projectId, fileName, duration, sampleRate) => {
        const id = genId()
        set((s) => ({
          audioFiles: [...s.audioFiles, { id, projectId, fileName, duration, sampleRate, status: 'temporary' as ConfirmStatus, uploadedAt: Date.now() }],
        }))
        return id
      },

      updateAudioFileStatus: (id, status) => {
        set((s) => ({
          audioFiles: s.audioFiles.map((a) => (a.id === id ? { ...a, status } : a)),
        }))
      },

      addBeatMarker: (projectId, timeSeconds, beatNumber, bpm) => {
        const id = genId()
        const now = Date.now()
        set((s) => ({
          beatMarkers: [...s.beatMarkers, { id, projectId, timeSeconds, beatNumber, bpm, status: 'temporary' as ConfirmStatus, driftOffset: 0, createdAt: now, updatedAt: now }],
        }))
        return id
      },

      updateBeatMarker: (id, data) => {
        set((s) => ({
          beatMarkers: s.beatMarkers.map((b) =>
            b.id === id ? { ...b, ...data, updatedAt: Date.now() } : b
          ),
        }))
      },

      deleteBeatMarker: (id) => {
        set((s) => ({
          beatMarkers: s.beatMarkers.filter((b) => b.id !== id),
        }))
      },

      confirmBeatMarker: (id) => {
        set((s) => ({
          beatMarkers: s.beatMarkers.map((b) =>
            b.id === id ? { ...b, status: 'confirmed', updatedAt: Date.now() } : b
          ),
        }))
      },

      addCutPoint: (projectId, startTime, endTime, label) => {
        const id = genId()
        const now = Date.now()
        set((s) => ({
          cutPoints: [...s.cutPoints, { id, projectId, startTime, endTime, label, status: 'temporary' as ConfirmStatus, hasOverlap: false, createdAt: now, updatedAt: now }],
        }))
        get().detectConflicts(projectId)
        return id
      },

      updateCutPoint: (id, data) => {
        const cp = get().cutPoints.find((c) => c.id === id)
        set((s) => ({
          cutPoints: s.cutPoints.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c
          ),
        }))
        if (cp) get().detectConflicts(cp.projectId)
      },

      deleteCutPoint: (id) => {
        const cp = get().cutPoints.find((c) => c.id === id)
        set((s) => ({
          cutPoints: s.cutPoints.filter((c) => c.id !== id),
        }))
        if (cp) get().detectConflicts(cp.projectId)
      },

      confirmCutPoint: (id) => {
        set((s) => ({
          cutPoints: s.cutPoints.map((c) =>
            c.id === id ? { ...c, status: 'confirmed', updatedAt: Date.now() } : c
          ),
        }))
      },

      addFormationNote: (projectId, startTime, endTime, description) => {
        const id = genId()
        const now = Date.now()
        set((s) => ({
          formationNotes: [...s.formationNotes, { id, projectId, startTime, endTime, description, status: 'temporary' as ConfirmStatus, createdAt: now, updatedAt: now }],
        }))
        get().detectConflicts(projectId)
        return id
      },

      updateFormationNote: (id, data) => {
        const fn = get().formationNotes.find((f) => f.id === id)
        set((s) => ({
          formationNotes: s.formationNotes.map((f) =>
            f.id === id ? { ...f, ...data, updatedAt: Date.now() } : f
          ),
        }))
        if (fn) get().detectConflicts(fn.projectId)
      },

      deleteFormationNote: (id) => {
        const fn = get().formationNotes.find((f) => f.id === id)
        set((s) => ({
          formationNotes: s.formationNotes.filter((f) => f.id !== id),
        }))
        if (fn) get().detectConflicts(fn.projectId)
      },

      confirmFormationNote: (id) => {
        set((s) => ({
          formationNotes: s.formationNotes.map((f) =>
            f.id === id ? { ...f, status: 'confirmed', updatedAt: Date.now() } : f
          ),
        }))
      },

      addStudentVersion: (projectId, versionName) => {
        const id = genId()
        const markers = get().beatMarkers.filter((b) => b.projectId === projectId)
        const cuts = get().cutPoints.filter((c) => c.projectId === projectId)
        const notes = get().formationNotes.filter((n) => n.projectId === projectId)
        const snapshotData = JSON.stringify({ markers, cuts, notes })
        set((s) => ({
          studentVersions: [...s.studentVersions, { id, projectId, versionName, snapshotData, status: 'temporary' as ConfirmStatus, createdAt: Date.now() }],
        }))
        return id
      },

      confirmStudentVersion: (id) => {
        set((s) => ({
          studentVersions: s.studentVersions.map((v) =>
            v.id === id ? { ...v, status: 'confirmed' } : v
          ),
        }))
      },

      addRehearsalReport: (projectId, title, content) => {
        const id = genId()
        set((s) => ({
          rehearsalReports: [...s.rehearsalReports, { id, projectId, title, content, status: 'temporary' as ConfirmStatus, createdAt: Date.now() }],
        }))
        return id
      },

      confirmRehearsalReport: (id) => {
        set((s) => ({
          rehearsalReports: s.rehearsalReports.map((r) =>
            r.id === id ? { ...r, status: 'confirmed' } : r
          ),
        }))
      },

      createVersionSnapshot: (projectId, label) => {
        const id = genId()
        const markers = get().beatMarkers.filter((b) => b.projectId === projectId)
        const cuts = get().cutPoints.filter((c) => c.projectId === projectId)
        const notes = get().formationNotes.filter((n) => n.projectId === projectId)
        const snapshotData = JSON.stringify({ markers, cuts, notes })
        set((s) => ({
          versionSnapshots: [...s.versionSnapshots, { id, projectId, label, snapshotData, createdAt: Date.now() }],
        }))
        return id
      },

      addOperation: (projectId, operationType, targetType, targetId, detail) => {
        const id = genId()
        set((s) => {
          const history = [
            ...s.operationHistory,
            { id, projectId, operationType, targetType, targetId, detail, timestamp: Date.now() },
          ]
          return { operationHistory: history.slice(-200) }
        })
      },

      detectConflicts: (projectId) => {
        const newConflicts: ConflictItem[] = []

        const markers = get()
          .beatMarkers.filter((b) => b.projectId === projectId)
          .sort((a, b) => a.timeSeconds - b.timeSeconds)

        if (markers.length >= 3) {
          const intervals = markers.slice(1).map((m, i) => m.timeSeconds - markers[i].timeSeconds)
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
          markers.forEach((m, i) => {
            if (i > 0) {
              const interval = m.timeSeconds - markers[i - 1].timeSeconds
              const deviation = Math.abs(interval - avgInterval) / avgInterval
              if (deviation > 0.15) {
                newConflicts.push({
                  id: `drift-${m.id}`,
                  type: 'beat_drift',
                  targetId: m.id,
                  projectId,
                  message: `第 ${m.beatNumber} 拍间隔偏差 ${(deviation * 100).toFixed(1)}%（阈值 15%）`,
                  severity: deviation > 0.3 ? 'error' : 'warning',
                  suggestion: '您可以尝试：1. 手动调整该八拍位置 2. 重新运行节拍检测 3. 检查音频质量',
                })
              }
            }
          })
        }

        const cuts = get().cutPoints.filter((c) => c.projectId === projectId)
        for (let i = 0; i < cuts.length; i++) {
          for (let j = i + 1; j < cuts.length; j++) {
            const a = cuts[i]
            const b = cuts[j]
            if (a.startTime < b.endTime && b.startTime < a.endTime) {
              newConflicts.push({
                id: `overlap-${a.id}-${b.id}`,
                type: 'cut_overlap',
                targetId: a.id,
                projectId,
                message: `剪辑点「${a.label}」与「${b.label}」时间重叠`,
                severity: 'error',
                suggestion: '您可以尝试：1. 调整剪辑点时间范围 2. 合并重叠的剪辑点 3. 删除多余的剪辑点',
              })
              set((s) => ({
                cutPoints: s.cutPoints.map((c) =>
                  c.id === a.id || c.id === b.id ? { ...c, hasOverlap: true } : c
                ),
              }))
            }
          }
        }

        const notes = get().formationNotes.filter((n) => n.projectId === projectId)
        for (let i = 0; i < notes.length; i++) {
          for (let j = i + 1; j < notes.length; j++) {
            const a = notes[i]
            const b = notes[j]
            if (a.startTime < b.endTime && b.startTime < a.endTime) {
              newConflicts.push({
                id: `overwrite-${a.id}-${b.id}`,
                type: 'note_overwrite',
                targetId: a.id,
                projectId,
                message: `队形备注时间重叠：「${a.description}」与「${b.description}」`,
                severity: 'warning',
                suggestion: '您可以尝试：1. 调整备注时间范围 2. 合并为一条备注 3. 删除旧备注',
              })
            }
          }
        }

        set((s) => ({
          conflicts: [...s.conflicts.filter((c) => c.projectId !== projectId), ...newConflicts],
        }))

        const driftMarkerIds = newConflicts
          .filter((c) => c.type === 'beat_drift')
          .map((c) => c.targetId)
        if (driftMarkerIds.length > 0) {
          set((s) => ({
            beatMarkers: s.beatMarkers.map((b) =>
              b.projectId === projectId
                ? { ...b, status: driftMarkerIds.includes(b.id) ? 'conflict' : b.status }
                : b
            ),
          }))
        }
      },

      clearConflicts: (projectId) => {
        set((s) => ({
          conflicts: s.conflicts.filter((c) => c.projectId !== projectId),
        }))
      },

      generateBeatMarkers: (projectId, bpm, duration) => {
        const interval = (60 / bpm) * 8
        let time = 0
        let beatNum = 1
        const now = Date.now()
        const newMarkers: BeatMarker[] = []
        while (time < duration) {
          newMarkers.push({
            id: genId(),
            projectId,
            timeSeconds: Math.round(time * 1000) / 1000,
            beatNumber: beatNum,
            bpm,
            status: 'temporary',
            driftOffset: 0,
            createdAt: now,
            updatedAt: now,
          })
          time += interval
          beatNum++
        }
        set((s) => ({
          beatMarkers: [...s.beatMarkers.filter((b) => b.projectId !== projectId), ...newMarkers],
        }))
        get().detectConflicts(projectId)
      },
    }),
    {
      name: 'dance-music-assistant-storage',
      version: 1,
    }
  )
)
