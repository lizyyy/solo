import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  InspectionTask,
  InspectionMark,
  FloorSketch,
  ConflictRecord,
  ZAxisAbnormal,
  SelfCheckReport,
  MaterialType,
  ImportPreviewResult,
  PathPoint,
  ReportData
} from '@/types';
import { generateUUID } from '@/utils/coordinate';

interface AppState {
  tasks: InspectionTask[];
  currentTaskId: string | null;
  selectedMarkId: string | null;
  isLoading: boolean;
  replayTime: number;
  isPlaying: boolean;

  getCurrentTask: () => InspectionTask | null;
  setCurrentTask: (taskId: string | null) => void;
  selectMark: (markId: string | null) => void;

  createTask: (data: Partial<InspectionTask>) => InspectionTask;
  updateTask: (taskId: string, updates: Partial<InspectionTask>) => void;
  deleteTask: (taskId: string) => void;

  addMarks: (taskId: string, marks: InspectionMark[]) => void;
  updateMark: (taskId: string, markId: string, updates: Partial<InspectionMark>) => void;

  addSketch: (taskId: string, sketch: FloorSketch) => void;
  addConflict: (taskId: string, conflict: ConflictRecord) => void;
  updateConflict: (taskId: string, conflictId: string, updates: Partial<ConflictRecord>) => void;
  addAbnormality: (taskId: string, abnormal: ZAxisAbnormal) => void;
  updateAbnormality: (taskId: string, abnormalId: string, updates: Partial<ZAxisAbnormal>) => void;
  addSelfCheckReport: (taskId: string, report: SelfCheckReport) => void;

  setReplayTime: (time: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;

  importPreview: ImportPreviewResult | null;
  setImportPreview: (preview: ImportPreviewResult | null) => void;

  pathPoints: PathPoint[];
  setPathPoints: (points: PathPoint[]) => void;

  reportData: ReportData | null;
  setReportData: (data: ReportData | null) => void;

  resetAll: () => void;
}

const initialState = {
  tasks: [],
  currentTaskId: null,
  selectedMarkId: null,
  isLoading: false,
  replayTime: 0,
  isPlaying: false,
  importPreview: null,
  pathPoints: [],
  reportData: null
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      getCurrentTask: () => {
        const { tasks, currentTaskId } = get();
        return tasks.find(t => t.id === currentTaskId) || null;
      },

      setCurrentTask: (taskId) => set({ currentTaskId: taskId }),

      selectMark: (markId) => set({ selectedMarkId: markId }),

      createTask: (data) => {
        const newTask: InspectionTask = {
          id: generateUUID(),
          taskNo: data.taskNo || `TASK-${Date.now()}`,
          projectName: data.projectName || '未命名项目',
          inspectionDate: data.inspectionDate || new Date().toISOString().split('T')[0],
          inspector: data.inspector || '未登记',
          status: data.status || 'draft',
          rawMaterials: [],
          marks: [],
          sketches: [],
          conflicts: [],
          abnormalities: [],
          selfCheckReports: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        set((state) => ({
          tasks: [...state.tasks, newTask],
          currentTaskId: newTask.id
        }));
        return newTask;
      },

      updateTask: (taskId, updates) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? { ...t, ...updates, updatedAt: new Date().toISOString() }
            : t
        )
      })),

      deleteTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== taskId),
        currentTaskId: state.currentTaskId === taskId ? null : state.currentTaskId
      })),

      addMarks: (taskId, marks) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                marks: [...t.marks, ...marks],
                updatedAt: new Date().toISOString(),
                status: 'imported' as const
              }
            : t
        )
      })),

      updateMark: (taskId, markId, updates) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                marks: t.marks.map(m =>
                  m.id === markId ? { ...m, ...updates } : m
                ),
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

      addSketch: (taskId, sketch) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? { ...t, sketches: [...t.sketches, sketch], updatedAt: new Date().toISOString() }
            : t
        )
      })),

      addConflict: (taskId, conflict) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                conflicts: [...t.conflicts, conflict],
                status: 'conflict_detected' as const,
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

      updateConflict: (taskId, conflictId, updates) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                conflicts: t.conflicts.map(c =>
                  c.id === conflictId ? { ...c, ...updates } : c
                ),
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

      addAbnormality: (taskId, abnormal) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                abnormalities: [...t.abnormalities, abnormal],
                status: 'reviewing' as const,
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

      updateAbnormality: (taskId, abnormalId, updates) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                abnormalities: t.abnormalities.map(a =>
                  a.id === abnormalId ? { ...a, ...updates } : a
                ),
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

      addSelfCheckReport: (taskId, report) => set((state) => ({
        tasks: state.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                selfCheckReports: [...t.selfCheckReports, report],
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

      setReplayTime: (time) => set((state) => ({
        replayTime: typeof time === 'function' ? time(state.replayTime) : time
      })),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setIsLoading: (loading) => set({ isLoading: loading }),

      setImportPreview: (preview) => set({ importPreview: preview }),
      setPathPoints: (points) => set({ pathPoints: points }),
      setReportData: (data) => set({ reportData: data }),

      resetAll: () => set(initialState)
    }),
    {
      name: 'underwater-pipeline-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        currentTaskId: state.currentTaskId
      })
    }
  )
);
