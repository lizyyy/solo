import { create } from 'zustand';
import type { BillRecord, ConflictRecord, GapRecord, ParamVersion, OperationHistory, TeacherNote, SamplingList } from '../../shared/types';
import { api } from '../lib/api';

interface DataState {
  records: BillRecord[];
  conflicts: ConflictRecord[];
  gaps: GapRecord[];
  versions: ParamVersion[];
  history: OperationHistory[];
  teacherNotes: TeacherNote[];
  samplingLists: SamplingList[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;

  refreshAll: () => Promise<void>;

  refreshRecords: () => Promise<void>;
  refreshConflicts: () => Promise<void>;
  refreshGaps: () => Promise<void>;
  refreshVersions: () => Promise<void>;
  refreshHistory: () => Promise<void>;

  getRecordById: (id: string) => BillRecord | undefined;
  getRecordByNo: (recordNo: string) => BillRecord | undefined;
  getConflictByRecordId: (recordId: string) => ConflictRecord | undefined;
  getGapByRecordId: (recordId: string) => GapRecord | undefined;
  getHistoryByRecordId: (recordId: string) => OperationHistory[];
}

export const useDataStore = create<DataState>((set, get) => ({
  records: [],
  conflicts: [],
  gaps: [],
  versions: [],
  history: [],
  teacherNotes: [],
  samplingLists: [],
  loading: false,
  error: null,
  lastUpdated: null,

  refreshRecords: async () => {
    try {
      const res = await api.getRecords({ pageSize: 1000 });
      set({ records: res.records });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载记录失败' });
    }
  },

  refreshConflicts: async () => {
    try {
      const data = await api.getConflicts();
      set({ conflicts: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载冲突列表失败' });
    }
  },

  refreshGaps: async () => {
    try {
      const data = await api.getGaps();
      set({ gaps: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载断档列表失败' });
    }
  },

  refreshVersions: async () => {
    try {
      const data = await api.getVersions();
      set({ versions: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载版本列表失败' });
    }
  },

  refreshHistory: async () => {
    try {
      const data = await api.getHistory();
      set({ history: data });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载历史记录失败' });
    }
  },

  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().refreshRecords(),
        get().refreshConflicts(),
        get().refreshGaps(),
        get().refreshVersions(),
        get().refreshHistory(),
      ]);
      set({ lastUpdated: Date.now() });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '刷新数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  getRecordById: (id: string) => {
    return get().records.find((r) => r.id === id);
  },

  getRecordByNo: (recordNo: string) => {
    return get().records.find((r) => r.recordNo === recordNo);
  },

  getConflictByRecordId: (recordId: string) => {
    return get().conflicts.find((c) => c.recordId === recordId);
  },

  getGapByRecordId: (recordId: string) => {
    return get().gaps.find((g) => g.recordId === recordId);
  },

  getHistoryByRecordId: (recordId: string) => {
    return get().history
      .filter((h) => h.recordId === recordId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },
}));
