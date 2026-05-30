import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, SkeletonDefinition, MotionClip, Student, AngleResult, AnomalyLogEntry, Keyframe, Comment, Frame, ReportSummary, ManualNote } from '@/types'
import { DEFAULT_APP_STATE, DEFAULT_SKELETON } from '@/types'

interface ClassroomState {
  projectId: string | null
  projectName: string
  skeletonDefinition: SkeletonDefinition
  appState: AppState
  students: Student[]
  clips: MotionClip[]
  keyframes: Keyframe[]
  comments: Comment[]

  setProject: (id: string, name: string) => void
  setSkeletonDefinition: (def: SkeletonDefinition) => void
  updateAppState: (partial: Partial<AppState>) => void
  setStudents: (students: Student[]) => void
  addStudent: (student: Student) => void
  removeStudent: (id: string) => void
  updateStudent: (id: string, partial: Partial<Student>) => void
  setClips: (clips: MotionClip[]) => void
  addClip: (clip: MotionClip) => void
  removeClip: (id: string) => void
  updateClip: (id: string, partial: Partial<MotionClip>) => void
  setKeyframes: (keyframes: Keyframe[]) => void
  addKeyframe: (kf: Keyframe) => void
  removeKeyframe: (id: string) => void
  setComments: (comments: Comment[]) => void
  addComment: (comment: Comment) => void
  removeComment: (id: string) => void

  getActiveClip: () => MotionClip | undefined
  getCurrentFrame: () => Frame | undefined
  getAngleResultsForJoint: (jointName: string) => AngleResult[]
  getAnomalyLog: () => AnomalyLogEntry[]
  getReportSummary: () => ReportSummary
}

export const useClassroomStore = create<ClassroomState>()(
  persist(
    (set, get) => ({
      projectId: null,
      projectName: '',
      skeletonDefinition: DEFAULT_SKELETON,
      appState: { ...DEFAULT_APP_STATE },
      students: [],
      clips: [],
      keyframes: [],
      comments: [],

      setProject: (id, name) => set({ projectId: id, projectName: name }),
      setSkeletonDefinition: (def) => set({ skeletonDefinition: def }),
      updateAppState: (partial) =>
        set((s) => ({ appState: { ...s.appState, ...partial } })),
      setStudents: (students) => set({ students }),
      addStudent: (student) => set((s) => ({ students: [...s.students, student] })),
      removeStudent: (id) => set((s) => ({ students: s.students.filter((st) => st.id !== id) })),
      updateStudent: (id, partial) =>
        set((s) => ({
          students: s.students.map((st) => (st.id === id ? { ...st, ...partial } : st)),
        })),
      setClips: (clips) => set({ clips }),
      addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
      removeClip: (id) =>
        set((s) => ({
          clips: s.clips.filter((c) => c.id !== id),
          keyframes: s.keyframes.filter((k) => k.clipId !== id),
          comments: s.comments.filter((c) => c.clipId !== id),
        })),
      updateClip: (id, partial) =>
        set((s) => ({
          clips: s.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)),
        })),
      setKeyframes: (keyframes) => set({ keyframes }),
      addKeyframe: (kf) => set((s) => ({ keyframes: [...s.keyframes, kf] })),
      removeKeyframe: (id) =>
        set((s) => ({ keyframes: s.keyframes.filter((k) => k.id !== id) })),
      setComments: (comments) => set({ comments }),
      addComment: (comment) => set((s) => ({ comments: [...s.comments, comment] })),
      removeComment: (id) =>
        set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

      getActiveClip: () => {
        const { clips, appState } = get()
        return clips.find((c) => c.id === appState.activeClipId)
      },
      getCurrentFrame: () => {
        const clip = get().getActiveClip()
        if (!clip) return undefined
        return clip.frames.find((f) => f.frameIndex === get().appState.currentFrame) ?? clip.frames[0]
      },
      getAngleResultsForJoint: (jointName: string) => {
        const clip = get().getActiveClip()
        if (!clip) return []
        return clip.angleResults.filter((a) => a.jointName === jointName)
      },
      getAnomalyLog: () => {
        const clip = get().getActiveClip()
        return clip?.anomalyLog ?? []
      },
      getReportSummary: () => {
        const clip = get().getActiveClip()
        const { keyframes, comments } = get()
        const clipKfs = keyframes.filter((k) => k.clipId === clip?.id)
        const clipComments = comments.filter((c) => c.clipId === clip?.id)
        const anomalyByJoint: Record<string, number> = {}
        let totalAnomalies = 0
        if (clip) {
          for (const a of clip.angleResults) {
            if (a.isAnomaly) {
              anomalyByJoint[a.jointName] = (anomalyByJoint[a.jointName] ?? 0) + 1
              totalAnomalies++
            }
          }
        }
        const avgAngles: Record<string, number> = {}
        if (clip) {
          const grouped: Record<string, number[]> = {}
          for (const a of clip.angleResults) {
            if (!grouped[a.jointName]) grouped[a.jointName] = []
            grouped[a.jointName].push(a.angle)
          }
          for (const [name, angles] of Object.entries(grouped)) {
            avgAngles[name] = angles.reduce((s, v) => s + v, 0) / angles.length
          }
        }
        return {
          totalFrames: clip?.frames.length ?? 0,
          totalAnomalies,
          anomalyByJoint,
          avgAngles,
          keyframeCount: clipKfs.length,
          commentCount: clipComments.length,
        }
      },
    }),
    {
      name: 'motion-classroom-state',
      partialize: (state) => ({
        projectId: state.projectId,
        projectName: state.projectName,
        skeletonDefinition: state.skeletonDefinition,
        appState: state.appState,
        students: state.students,
        clips: state.clips,
        keyframes: state.keyframes,
        comments: state.comments,
      }),
    }
  )
)
