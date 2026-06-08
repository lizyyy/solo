import { create } from 'zustand';
import type {
  BoardingRecord,
  ExceptionQueueItem,
  ReviewStatus,
  ListRecordsQuery,
} from '../../shared/types.js';
import { api, type RecordListItem } from '@/services/api.js';

type Toast = { id: string; type: 'success' | 'warning' | 'error' | 'info'; message: string };

interface ReviewState {
  records: RecordListItem[];
  recordDetail: BoardingRecord | null;
  exceptions: ExceptionQueueItem[];
  loading: Record<string, boolean>;
  toasts: Toast[];
  filters: ListRecordsQuery;

  setFilters: (f: Partial<ListRecordsQuery>) => void;
  fetchRecords: () => Promise<void>;
  fetchRecord: (id: string) => Promise<void>;
  fetchExceptions: () => Promise<void>;

  updateRemark: (id: string, content: string, status: ReviewStatus) => Promise<void>;
  supplementRemark: (id: string, content: string) => Promise<{ exportId: string; changeDescription: string } | null>;
  updateExceptionStatus: (id: string, status: ReviewStatus) => Promise<{ passed: boolean; message: string } | null>;

  toast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

const setLoading = (set: any, key: string, value: boolean) =>
  set((s: ReviewState) => ({ loading: { ...s.loading, [key]: value } }));

export const useReviewStore = create<ReviewState>((set, get) => ({
  records: [],
  recordDetail: null,
  exceptions: [],
  loading: {},
  toasts: [],
  filters: {},

  setFilters: f => {
    set({ filters: { ...get().filters, ...f } });
    get().fetchRecords();
  },

  fetchRecords: async () => {
    setLoading(set, 'records', true);
    try {
      const data = await api.listRecords(get().filters);
      set({ records: data });
    } catch (e: any) {
      get().toast('error', e.message || '加载记录列表失败');
    } finally {
      setLoading(set, 'records', false);
    }
  },

  fetchRecord: async id => {
    setLoading(set, 'record', true);
    try {
      const data = await api.getRecord(id);
      set({ recordDetail: data });
    } catch (e: any) {
      get().toast('error', e.message || '加载记录详情失败');
    } finally {
      setLoading(set, 'record', false);
    }
  },

  fetchExceptions: async () => {
    setLoading(set, 'exceptions', true);
    try {
      const data = await api.listExceptions();
      set({ exceptions: data });
    } catch (e: any) {
      get().toast('error', e.message || '加载异常队列失败');
    } finally {
      setLoading(set, 'exceptions', false);
    }
  },

  updateRemark: async (id, content, status) => {
    setLoading(set, 'remark', true);
    try {
      const res = await api.updateRemark(id, { content, status });
      set(s => ({
        recordDetail: res.record,
        records: s.records.map(r => r.id === id ? {
          ...r,
          reviewStatus: res.record.reviewStatus,
          conclusion: res.record.conclusion,
          latestRemark: content,
          latestOperator: '寄养店长老周',
        } : r),
        exceptions: res.exceptionUpdated ? get().exceptions : s.exceptions,
      }));
      if (res.exceptionUpdated) await get().fetchExceptions();
      get().toast('success', res.message || '备注已同步至后端数据和导出结果');
    } catch (e: any) {
      get().toast('error', e.message || '保存备注失败');
    } finally {
      setLoading(set, 'remark', false);
    }
  },

  supplementRemark: async (id, content) => {
    setLoading(set, 'supplement', true);
    try {
      const res = await api.supplementRemark(id, { content });
      set(s => ({
        recordDetail: res.record,
        records: s.records.map(r => r.id === id ? {
          ...r,
          conclusion: res.record.conclusion,
          latestRemark: res.record.remarks[res.record.remarks.length - 1].content,
        } : r),
      }));
      get().toast('success', '补录备注成功，导出变更说明已生成');
      return { exportId: res.exportId, changeDescription: res.changeDescription };
    } catch (e: any) {
      get().toast('error', e.message || '补录备注失败');
      return null;
    } finally {
      setLoading(set, 'supplement', false);
    }
  },

  updateExceptionStatus: async (id, status) => {
    setLoading(set, 'excStatus', true);
    try {
      const res = await api.updateExceptionStatus(id, status);
      set(s => ({
        exceptions: s.exceptions.map(e => e.id === id ? res.exception : e),
      }));
      get().toast(res.consistencyCheck.passed ? 'success' : 'warning', res.consistencyCheck.message);
      return { passed: res.consistencyCheck.passed, message: res.consistencyCheck.message };
    } catch (e: any) {
      get().toast('error', e.message || '更新状态失败');
      return null;
    } finally {
      setLoading(set, 'excStatus', false);
    }
  },

  toast: (type, message) => {
    const id = Math.random().toString(36).slice(2, 8);
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().dismissToast(id), 2800);
  },

  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
