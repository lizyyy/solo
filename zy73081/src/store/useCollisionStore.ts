import { create } from 'zustand';
import type {
  CollisionRecord,
  ListFilterParams,
  RejudgePayload,
  SummaryData,
  HistoryRecord,
} from '@/types';
import { CollisionService } from '@/services/collisionService';

interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface CollisionState {
  loading: boolean;
  list: CollisionRecord[];
  summary: SummaryData;
  detail: CollisionRecord | null;
  history: HistoryRecord[];
  filters: ListFilterParams;
  toast: ToastMessage | null;
  actions: {
    setFilters: (f: Partial<ListFilterParams>) => void;
    loadList: () => Promise<void>;
    loadDetail: (id: string) => Promise<void>;
    loadHistory: (id: string) => Promise<void>;
    rejudge: (id: string, payload: RejudgePayload) => Promise<void>;
    toggleSample: (id: string, isSample: boolean) => Promise<void>;
    exportCSV: (filters?: ListFilterParams) => Promise<void>;
    showToast: (t: ToastMessage) => void;
    dismissToast: () => void;
  };
}

function downloadFromUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const useCollisionStore = create<CollisionState>((set, get) => ({
  loading: false,
  list: [],
  summary: { total: 0, passed: 0, pendingEvidence: 0, manualRejudged: 0, coordinateOffset: 0 },
  detail: null,
  history: [],
  filters: { status: 'ALL', coordinateOffsetOnly: false },
  toast: null,

  actions: {
    setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),

    loadList: async () => {
      set({ loading: true });
      try {
        const { data, summary } = await CollisionService.list(get().filters);
        set({ list: data, summary, loading: false });
      } catch (e) {
        const err = e as Error;
        set({ loading: false });
        get().actions.showToast({ message: err.message || '加载失败', type: 'error' });
      }
    },

    loadDetail: async (id: string) => {
      set({ loading: true, detail: null });
      try {
        const d = await CollisionService.get(id);
        set({ detail: d, loading: false });
      } catch (e) {
        const err = e as Error;
        set({ loading: false });
        get().actions.showToast({ message: err.message || '加载详情失败', type: 'error' });
      }
    },

    loadHistory: async (id: string) => {
      try {
        const h = await CollisionService.getHistory(id);
        set({ history: h });
      } catch {
        set({ history: [] });
      }
    },

    rejudge: async (id: string, payload: RejudgePayload) => {
      set({ loading: true });
      try {
        const updated = await CollisionService.rejudge(id, payload);
        set((s) => ({
          detail: updated,
          list: s.list.map((c) => (c.id === id ? updated : c)),
          loading: false,
        }));
        await get().actions.loadList();
        get().actions.showToast({ message: '改判已写入，并记录历史', type: 'success' });
      } catch (e) {
        const err = e as Error;
        set({ loading: false });
        get().actions.showToast({ message: err.message || '改判失败', type: 'error' });
      }
    },

    toggleSample: async (id: string, isSample: boolean) => {
      try {
        const updated = await CollisionService.toggleSample(id, isSample);
        set((s) => ({
          detail: s.detail && s.detail.id === id ? updated : s.detail,
          list: s.list.map((c) => (c.id === id ? updated : c)),
        }));
        get().actions.showToast({
          message: isSample ? '已标记为样例' : '已取消样例标记',
          type: 'success',
        });
      } catch (e) {
        const err = e as Error;
        get().actions.showToast({ message: err.message || '操作失败', type: 'error' });
      }
    },

    exportCSV: async (filters) => {
      set({ loading: true });
      try {
        const url = CollisionService.getExportUrl(filters || get().filters);
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        downloadFromUrl(url, `幕墙节点碰撞预审明细_${stamp}.csv`);
        set({ loading: false });
        get().actions.showToast({ message: 'CSV 明细已开始下载', type: 'success' });
      } catch (e) {
        const err = e as Error;
        set({ loading: false });
        get().actions.showToast({ message: err.message || '导出失败', type: 'error' });
      }
    },

    showToast: (t) => {
      set({ toast: t });
      setTimeout(() => set({ toast: null }), 2800);
    },
    dismissToast: () => set({ toast: null }),
  },
}));
