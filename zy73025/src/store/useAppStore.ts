import { create } from 'zustand';
import type {
  TempRecord,
  HistoryEntry,
  ExceptionItem,
  RecordStatus,
  RejudgeRequest,
  SupplementRequest,
  ExceptionType,
} from '@shared/types';
import { apiGet, apiPost, apiPut } from '@/utils/api';

interface ListFilters {
  status?: RecordStatus;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

interface AppState {
  records: TempRecord[];
  currentRecord: TempRecord | null;
  history: HistoryEntry[];
  queue: ExceptionItem[];

  recordsLoading: boolean;
  recordLoading: boolean;
  historyLoading: boolean;
  queueLoading: boolean;

  lastError: string | null;

  fetchRecords: (filters?: ListFilters) => Promise<void>;
  fetchRecord: (id: string) => Promise<void>;
  fetchHistory: (id: string) => Promise<void>;
  fetchQueue: (type?: ExceptionType) => Promise<void>;

  rejudge: (id: string, payload: Omit<RejudgeRequest, 'supplementIds'>) => Promise<TempRecord>;
  supplement: (id: string, payload: SupplementRequest) => Promise<TempRecord>;
  ackException: (id: string, note: string, operator: string) => Promise<ExceptionItem>;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  currentRecord: null,
  history: [],
  queue: [],

  recordsLoading: false,
  recordLoading: false,
  historyLoading: false,
  queueLoading: false,

  lastError: null,

  fetchRecords: async (filters) => {
    set({ recordsLoading: true, lastError: null });
    try {
      const params: Record<string, string | undefined> = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.keyword) params.petName = filters.keyword;

      const data = await apiGet<TempRecord[]>('/api/records', params);
      set({ records: data ?? [] });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : '加载记录列表失败' });
      set({ records: [] });
    } finally {
      set({ recordsLoading: false });
    }
  },

  fetchRecord: async (id) => {
    set({ recordLoading: true, lastError: null });
    try {
      const data = await apiGet<TempRecord>(`/api/records/${id}`);
      set({ currentRecord: data });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : '加载记录详情失败' });
      set({ currentRecord: null });
    } finally {
      set({ recordLoading: false });
    }
  },

  fetchHistory: async (id) => {
    set({ historyLoading: true, lastError: null });
    try {
      const data = await apiGet<HistoryEntry[]>(`/api/records/${id}/history`);
      set({ history: data ?? [] });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : '加载历史记录失败' });
      set({ history: [] });
    } finally {
      set({ historyLoading: false });
    }
  },

  fetchQueue: async (type) => {
    set({ queueLoading: true, lastError: null });
    try {
      const params = type ? { type } : undefined;
      const data = await apiGet<ExceptionItem[]>('/api/queue', params);
      set({ queue: data ?? [] });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : '加载异常队列失败' });
      set({ queue: [] });
    } finally {
      set({ queueLoading: false });
    }
  },

  rejudge: async (id, payload) => {
    set({ lastError: null });
    const body: RejudgeRequest = { ...payload, supplementIds: [] };
    const data = await apiPut<TempRecord>(`/api/records/${id}/conclusion`, body);
    if (data) {
      set({ currentRecord: data });
      const existing = get().records;
      const idx = existing.findIndex((r) => r.id === id);
      if (idx >= 0) {
        const next = [...existing];
        next[idx] = data;
        set({ records: next });
      }
    }
    return data;
  },

  supplement: async (id, payload) => {
    set({ lastError: null });
    const data = await apiPost<TempRecord>(`/api/records/${id}/supplement`, payload);
    if (data) {
      set({ currentRecord: data });
      const existing = get().records;
      const idx = existing.findIndex((r) => r.id === id);
      if (idx >= 0) {
        const next = [...existing];
        next[idx] = data;
        set({ records: next });
      }
    }
    return data;
  },

  ackException: async (id, note, operator) => {
    set({ lastError: null });
    const data = await apiPost<ExceptionItem>(`/api/queue/${id}/ack`, { note, operator });
    if (data) {
      const existing = get().queue;
      const idx = existing.findIndex((q) => q.id === id);
      if (idx >= 0) {
        const next = [...existing];
        next[idx] = data;
        set({ queue: next });
      }
    }
    return data;
  },
}));
