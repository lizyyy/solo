import { create } from 'zustand';
import type {
  MaintenanceScreenshot,
  SamplingInterval,
  CavitationCalculation,
  ChangeRecord,
  ExperimentReview,
  ReviewTask,
  User,
  DataTraceInfo,
  ViewMode,
} from '../../shared/types';

interface AppState {
  currentUser: User | null;
  users: User[];
  screenshots: MaintenanceScreenshot[];
  samplingIntervals: SamplingInterval[];
  calculations: CavitationCalculation[];
  changeRecords: ChangeRecord[];
  reviewTasks: ReviewTask[];
  reviews: ExperimentReview[];
  selectedCalculation: CavitationCalculation | null;
  selectedScreenshot: MaintenanceScreenshot | null;
  dataTraceInfo: DataTraceInfo | null;
  viewMode: ViewMode;
  isLoading: boolean;
  notifications: { id: string; type: 'success' | 'error' | 'info'; message: string }[];

  setCurrentUser: (user: User) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedCalculation: (calc: CavitationCalculation | null) => void;
  setSelectedScreenshot: (shot: MaintenanceScreenshot | null) => void;
  setDataTraceInfo: (info: DataTraceInfo | null) => void;
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;

  loadAllData: () => Promise<void>;
  loadCalculations: () => Promise<void>;
  loadScreenshots: () => Promise<void>;
  loadSamplingIntervals: () => Promise<void>;
  loadReviewTasks: () => Promise<void>;
  loadChangeRecords: (entityType?: string, entityId?: string) => Promise<void>;

  uploadScreenshot: (file: File) => Promise<MaintenanceScreenshot | null>;
  updateScreenshot: (id: string, data: any, reason: string) => Promise<void>;
  createCalculation: (data: any) => Promise<CavitationCalculation | null>;
  updateCalculation: (id: string, updates: any, reason: string) => Promise<void>;
  updateCalculationRemark: (id: string, remark: string, reason: string) => Promise<void>;
  resolveReviewTask: (taskId: string, resolution: string, markAsNormal: boolean) => Promise<void>;
  createReview: (calculationId: string, decisions: any[]) => Promise<ExperimentReview | null>;
  generateReport: (calculationId: string) => Promise<any>;
}

const API_BASE = '/api';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  users: [],
  screenshots: [],
  samplingIntervals: [],
  calculations: [],
  changeRecords: [],
  reviewTasks: [],
  reviews: [],
  selectedCalculation: null,
  selectedScreenshot: null,
  dataTraceInfo: null,
  viewMode: 'list',
  isLoading: false,
  notifications: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedCalculation: (calc) => set({ selectedCalculation: calc }),
  setSelectedScreenshot: (shot) => set({ selectedScreenshot: shot }),
  setDataTraceInfo: (info) => set({ dataTraceInfo: info }),

  addNotification: (type, message) => {
    const id = `notif-${Date.now()}`;
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    setTimeout(() => get().removeNotification(id), 4000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  loadAllData: async () => {
    set({ isLoading: true });
    try {
      const [users, screenshots, intervals, calcs, tasks] = await Promise.all([
        apiFetch<User[]>('/users'),
        apiFetch<MaintenanceScreenshot[]>('/screenshots'),
        apiFetch<SamplingInterval[]>('/sampling-intervals'),
        apiFetch<CavitationCalculation[]>('/calculations'),
        apiFetch<ReviewTask[]>('/review/tasks'),
      ]);
      set({
        users,
        screenshots,
        samplingIntervals: intervals,
        calculations: calcs,
        reviewTasks: tasks,
        currentUser: users[0],
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      get().addNotification('error', '加载数据失败');
    }
  },

  loadCalculations: async () => {
    const calcs = await apiFetch<CavitationCalculation[]>('/calculations');
    set({ calculations: calcs });
  },

  loadScreenshots: async () => {
    const shots = await apiFetch<MaintenanceScreenshot[]>('/screenshots');
    set({ screenshots: shots });
  },

  loadSamplingIntervals: async () => {
    const intervals = await apiFetch<SamplingInterval[]>('/sampling-intervals');
    set({ samplingIntervals: intervals });
  },

  loadReviewTasks: async () => {
    const tasks = await apiFetch<ReviewTask[]>('/review/tasks');
    set({ reviewTasks: tasks });
  },

  loadChangeRecords: async (entityType?, entityId?) => {
    const params = new URLSearchParams();
    if (entityType) params.append('entityType', entityType);
    if (entityId) params.append('entityId', entityId);
    const records = await apiFetch<ChangeRecord[]>(`/audit?${params.toString()}`);
    set({ changeRecords: records });
  },

  uploadScreenshot: async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const duplicateCheck = await apiFetch<any>('/screenshots/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({ fileHash, fileName: file.name }),
      });

      if (duplicateCheck.isDuplicate) {
        const result = await apiFetch<any>('/screenshots/upload', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            uploader: get().currentUser?.id || 'user-1',
            fileHash,
            isDuplicate: true,
            duplicateOf: duplicateCheck.existingScreenshot.id,
          }),
        });
        get().addNotification('info', result.message);
        await get().loadScreenshots();
        return result.screenshot;
      }

      const result = await apiFetch<any>('/screenshots/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          uploader: get().currentUser?.id || 'user-1',
          fileHash,
        }),
      });

      get().addNotification('success', result.message);
      await get().loadScreenshots();
      return result.screenshot;
    } catch (error) {
      get().addNotification('error', '上传截图失败');
      return null;
    }
  },

  updateScreenshot: async (id, data, reason) => {
    try {
      await apiFetch(`/screenshots/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          changedBy: get().currentUser?.id,
          changeReason: reason,
        }),
      });
      get().addNotification('success', '截图数据已更新');
      await get().loadScreenshots();
      await get().loadChangeRecords('screenshot', id);
    } catch (error) {
      get().addNotification('error', '更新失败');
    }
  },

  createCalculation: async (data) => {
    try {
      const calc = await apiFetch<CavitationCalculation>('/calculations', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          createdBy: get().currentUser?.id,
        }),
      });
      get().addNotification('success', '计算任务已创建');
      await get().loadCalculations();
      await get().loadReviewTasks();
      return calc;
    } catch (error) {
      get().addNotification('error', '创建计算失败');
      return null;
    }
  },

  updateCalculation: async (id, updates, reason) => {
    try {
      await apiFetch(`/calculations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          updates,
          updatedBy: get().currentUser?.id,
          changeReason: reason,
        }),
      });
      get().addNotification('success', '计算已更新');
      await get().loadCalculations();
      await get().loadChangeRecords('calculation', id);
    } catch (error) {
      get().addNotification('error', '更新失败');
    }
  },

  updateCalculationRemark: async (id, remark, reason) => {
    await get().updateCalculation(id, { remark }, reason);
  },

  resolveReviewTask: async (taskId, resolution, markAsNormal) => {
    try {
      await apiFetch(`/review/tasks/${taskId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution,
          resolvedBy: get().currentUser?.id,
          markAsNormal,
        }),
      });
      get().addNotification('success', markAsNormal ? '复核通过' : '已标记问题');
      await get().loadReviewTasks();
      await get().loadCalculations();
    } catch (error) {
      get().addNotification('error', '操作失败');
    }
  },

  createReview: async (calculationId, decisions) => {
    try {
      const review = await apiFetch<ExperimentReview>('/review/reviews', {
        method: 'POST',
        body: JSON.stringify({
          calculationId,
          decisions,
          createdBy: get().currentUser?.id,
        }),
      });
      get().addNotification('success', '复盘报告已生成');
      await get().loadCalculations();
      return review;
    } catch (error) {
      get().addNotification('error', '生成复盘失败');
      return null;
    }
  },

  generateReport: async (calculationId) => {
    try {
      return await apiFetch<any>(`/review/reports/${calculationId}`);
    } catch (error) {
      get().addNotification('error', '生成报告失败');
      return null;
    }
  },
}));
