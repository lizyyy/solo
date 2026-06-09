import { create } from 'zustand';
import type {
  ReviewTask,
  CadLayer,
  LayerHistory,
  Screenshot,
  TaskStatus,
  LayerStatus,
} from '@shared/types';
import * as api from '@/lib/api';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastState {
  type: ToastType;
  msg: string;
}

interface AppState {
  tasks: ReviewTask[];
  currentTask: ReviewTask | null;
  layers: CadLayer[];
  currentLayer: CadLayer | null;
  currentLayerHistory: LayerHistory[];
  history: api.TaskHistoryItem[];
  screenshots: Screenshot[];
  toast: ToastState | null;
  loading: boolean;

  setToast: (msg: string | null, type?: ToastType) => void;
  setLoading: (v: boolean) => void;

  fetchTasks: (status?: TaskStatus, search?: string) => Promise<void>;
  createTask: (payload: Partial<ReviewTask> & { projectName: string; drawingVersion: string; cadSource: string }) => Promise<ReviewTask | null>;
  fetchTask: (id: string) => Promise<void>;
  updateTask: (id: string, patch: Partial<ReviewTask>) => Promise<ReviewTask | null>;
  fetchTaskLayers: (taskId: string) => Promise<void>;
  fetchTaskHistory: (taskId: string) => Promise<void>;
  compareHistory: (
    taskId: string,
    layerId: string,
    v1: number,
    v2: number,
  ) => Promise<{
    v1?: LayerHistory;
    v2?: LayerHistory;
    diff: api.VersionDiff;
  } | null>;
  exportTask: (taskId: string) => void;

  fetchLayer: (id: string) => Promise<void>;
  submitLayerReview: (
    layerId: string,
    payload: {
      status: LayerStatus;
      opinion: string;
      note?: string;
      reviewer?: string;
      standardTags?: string[];
      screenshotIds?: string[];
    },
  ) => Promise<CadLayer | null>;
  appendLayerNote: (
    layerId: string,
    payload: { note: string },
  ) => Promise<CadLayer | null>;

  uploadScreenshot: (taskId: string, formData: FormData) => Promise<Screenshot | null>;
  fetchTaskScreenshots: (taskId: string) => Promise<void>;
  downloadScreenshot: (id: string) => void;
  deleteScreenshot: (id: string) => Promise<boolean>;

  fetchGuide: () => Promise<api.GuideData | null>;
}

type SetFn = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>),
  replace?: boolean,
) => void;

function withLoading<T>(
  set: SetFn,
  fn: () => Promise<T>,
  opts: { toastOnError?: boolean } = {},
): Promise<T> {
  const { toastOnError = true } = opts;
  set({ loading: true });
  return fn()
    .then((res) => {
      set({ loading: false });
      return res;
    })
    .catch((err: unknown) => {
      set({ loading: false });
      if (toastOnError) {
        const msg = err instanceof Error ? err.message : '操作失败';
        set({ toast: { type: 'error', msg } });
      }
      throw err;
    });
}

export const useAppStore = create<AppState>((set, get) => ({
  tasks: [],
  currentTask: null,
  layers: [],
  currentLayer: null,
  currentLayerHistory: [],
  history: [],
  screenshots: [],
  toast: null,
  loading: false,

  setToast: (msg, type = 'info') => {
    if (msg === null) {
      set({ toast: null });
    } else {
      set({ toast: { type, msg } });
    }
  },

  setLoading: (v) => set({ loading: v }),

  fetchTasks: async (status, search) => {
    return withLoading(set, async () => {
      const tasks = await api.fetchTasks(status, search);
      set({ tasks });
    });
  },

  createTask: async (payload) => {
    return withLoading(set, async () => {
      const task = await api.createTask(payload);
      set((s) => ({ tasks: [task, ...s.tasks] }));
      get().setToast('任务创建成功', 'success');
      return task;
    });
  },

  fetchTask: async (id) => {
    return withLoading(set, async () => {
      const task = await api.fetchTask(id);
      set({ currentTask: task });
    });
  },

  updateTask: async (id, patch) => {
    return withLoading(set, async () => {
      const task = await api.updateTask(id, patch);
      set((s) => ({
        currentTask: task,
        tasks: s.tasks.map((t) => (t.id === id ? task : t)),
      }));
      get().setToast('任务更新成功', 'success');
      return task;
    });
  },

  fetchTaskLayers: async (taskId) => {
    return withLoading(set, async () => {
      const layers = await api.fetchTaskLayers(taskId);
      set({ layers });
    });
  },

  fetchTaskHistory: async (taskId) => {
    return withLoading(set, async () => {
      const history = await api.fetchTaskHistory(taskId);
      set({ history });
    });
  },

  compareHistory: async (taskId, layerId, v1, v2) => {
    return withLoading(set, async () => {
      return api.compareHistory(taskId, layerId, v1, v2);
    });
  },

  exportTask: (taskId) => {
    api.exportTask(taskId);
  },

  fetchLayer: async (id) => {
    return withLoading(set, async () => {
      const layer = await api.fetchLayer(id);
      set({ currentLayer: layer });
    });
  },

  submitLayerReview: async (layerId, payload) => {
    return withLoading(set, async () => {
      const layer = await api.submitLayerReview(layerId, payload);
      set((s) => ({
        currentLayer: layer,
        layers: s.layers.map((l) => (l.id === layerId ? layer : l)),
      }));
      get().setToast('复核意见已提交', 'success');
      return layer;
    });
  },

  appendLayerNote: async (layerId, payload) => {
    return withLoading(set, async () => {
      const layer = await api.appendLayerNote(layerId, payload);
      set((s) => ({
        currentLayer: layer,
        layers: s.layers.map((l) => (l.id === layerId ? layer : l)),
      }));
      get().setToast('备注已追加', 'success');
      return layer;
    });
  },

  uploadScreenshot: async (taskId, formData) => {
    return withLoading(set, async () => {
      const shot = await api.uploadScreenshot(taskId, formData);
      set((s) => ({ screenshots: [shot, ...s.screenshots] }));
      get().setToast('截图上传成功', 'success');
      return shot;
    });
  },

  fetchTaskScreenshots: async (taskId) => {
    return withLoading(set, async () => {
      const screenshots = await api.fetchTaskScreenshots(taskId);
      set({ screenshots });
    });
  },

  downloadScreenshot: (id) => {
    api.downloadScreenshot(id);
  },

  deleteScreenshot: async (id) => {
    try {
      set({ loading: true });
      await api.deleteScreenshot(id);
      set((s) => ({
        screenshots: s.screenshots.filter((s2) => s2.id !== id),
        loading: false,
      }));
      get().setToast('截图已删除', 'success');
      return true;
    } catch (err) {
      set({ loading: false });
      const msg = err instanceof Error ? err.message : '删除失败';
      set({ toast: { type: 'error', msg } });
      return false;
    }
  },

  fetchGuide: async () => {
    return withLoading(set, async () => {
      return api.fetchGuide();
    });
  },
}));
