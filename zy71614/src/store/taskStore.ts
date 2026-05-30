import { create } from 'zustand';
import type { SettlementTask, BoxOfficeRecord, ShowSession, FilmContract, SettlementResult, VersionHistory } from '@/types';
import * as api from '@/utils/api';

interface TaskStore {
  tasks: SettlementTask[];
  currentTask: SettlementTask | null;
  boxOfficeRecords: BoxOfficeRecord[];
  showSessions: ShowSession[];
  filmContracts: FilmContract[];
  settlementResults: SettlementResult[];
  versionHistory: VersionHistory[];
  currentStep: number;
  loading: boolean;

  fetchTasks: () => Promise<void>;
  createTask: (payload: { name: string; periodStart: string; periodEnd: string }) => Promise<SettlementTask>;
  fetchTaskDetail: (id: string) => Promise<void>;
  saveTask: () => Promise<void>;
  withdrawTask: (versionId?: string) => Promise<void>;
  fetchHistory: (taskId: string) => Promise<void>;
  importData: (taskId: string, type: 'tickets' | 'refunds' | 'coupons' | 'shows' | 'contracts', data: any[]) => Promise<void>;
  mapSessions: (taskId: string) => Promise<void>;
  calculate: (taskId: string) => Promise<void>;
  exportReport: (taskId: string) => Promise<void>;
  updateNote: (recordId: string, diffNote: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  setCurrentStep: (step: number) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  currentTask: null,
  boxOfficeRecords: [],
  showSessions: [],
  filmContracts: [],
  settlementResults: [],
  versionHistory: [],
  currentStep: 0,
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await api.fetchTasks();
      set({ tasks });
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (payload) => {
    const task = await api.createTask(payload);
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  fetchTaskDetail: async (id) => {
    set({ loading: true });
    try {
      const [task, records, sessions, contracts, results] = await Promise.all([
        api.fetchTaskDetail(id),
        api.fetchBoxOfficeRecords(id).catch(() => [] as BoxOfficeRecord[]),
        api.fetchShowSessions(id).catch(() => [] as ShowSession[]),
        api.fetchFilmContracts(id).catch(() => [] as FilmContract[]),
        api.fetchSettlementResults(id).catch(() => [] as SettlementResult[]),
      ]);
      set({
        currentTask: task,
        boxOfficeRecords: records,
        showSessions: sessions,
        filmContracts: contracts,
        settlementResults: results,
      });
    } finally {
      set({ loading: false });
    }
  },

  saveTask: async () => {
    const { currentTask } = get();
    if (!currentTask) return;
    set({ loading: true });
    try {
      const updated = await api.saveTask(currentTask.id);
      set({ currentTask: updated });
    } finally {
      set({ loading: false });
    }
  },

  withdrawTask: async (versionId) => {
    const { currentTask } = get();
    if (!currentTask) return;
    set({ loading: true });
    try {
      const updated = await api.withdrawTask(currentTask.id, versionId);
      set({ currentTask: updated });
    } finally {
      set({ loading: false });
    }
  },

  fetchHistory: async (taskId) => {
    set({ loading: true });
    try {
      const history = await api.fetchHistory(taskId);
      set({ versionHistory: history });
    } finally {
      set({ loading: false });
    }
  },

  importData: async (taskId, type, data) => {
    set({ loading: true });
    try {
      await api.importData(taskId, type, data);
      await get().fetchTaskDetail(taskId);
    } finally {
      set({ loading: false });
    }
  },

  mapSessions: async (taskId) => {
    set({ loading: true });
    try {
      await api.mapSessions(taskId);
      await get().fetchTaskDetail(taskId);
    } finally {
      set({ loading: false });
    }
  },

  calculate: async (taskId) => {
    set({ loading: true });
    try {
      await api.calculate(taskId);
      await get().fetchTaskDetail(taskId);
    } finally {
      set({ loading: false });
    }
  },

  exportReport: async (taskId) => {
    const blob = await api.exportReport(taskId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `分账报告_${taskId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  updateNote: async (recordId, diffNote) => {
    await api.updateNote(recordId, diffNote);
    set((s) => ({
      boxOfficeRecords: s.boxOfficeRecords.map((r) =>
        r.id === recordId ? { ...r, diffNote } : r
      ),
    }));
  },

  resumeTask: async (taskId) => {
    set({ loading: true });
    try {
      const updated = await api.resumeTask(taskId);
      set({ currentTask: updated });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentStep: (step) => set({ currentStep: step }),
}));
