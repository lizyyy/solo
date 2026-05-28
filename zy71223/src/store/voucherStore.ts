import { create } from 'zustand';
import type { CashVoucher, AccountSubject, CollationReport, BalanceRecord, SubjectSuggestion, BalanceWarning } from '../../shared/types';

const API_BASE = 'http://localhost:3001/api';

interface VoucherState {
  vouchers: CashVoucher[];
  voucher: CashVoucher | null;
  subjects: AccountSubject[];
  reports: CollationReport[];
  balances: BalanceRecord[];
  suggestions: SubjectSuggestion[];
  warnings: BalanceWarning[];
  loading: boolean;
  error: string | null;
  summary: { total: number; pending: number; parsing: number; reviewing: number; revised: number; completed: number; exception: number };

  fetchVouchers: (params?: { status?: string; customer?: string; startDate?: string; endDate?: string }) => Promise<void>;
  fetchVoucher: (id: string) => Promise<void>;
  fetchSubjects: () => Promise<void>;
  fetchReports: () => Promise<void>;
  fetchBalances: (period?: string) => Promise<void>;
  getSubjectSuggestions: (voucherId: string) => Promise<void>;
  checkBalanceWarnings: (period: string) => Promise<void>;

  createVoucher: (data: FormData) => Promise<CashVoucher | null>;
  parseVoucher: (id: string, operator: string) => Promise<void>;
  updateSubjectMapping: (id: string, mappingId: string, data: { subjectId: string; adjustmentReason: string }, operator: string) => Promise<void>;
  addNote: (voucherId: string, content: string, createdBy: string) => Promise<void>;
  completeVoucher: (id: string, operator: string) => Promise<void>;

  generateReport: (period: string, operator: string) => Promise<CollationReport | null>;
  exportReport: (reportId: string, format: 'csv' | 'excel', operator: string) => Promise<void>;
  calculateBalances: (period: string) => Promise<void>;

  clearError: () => void;
  clearVoucher: () => void;
}

export const useVoucherStore = create<VoucherState>((set, get) => ({
  vouchers: [],
  voucher: null,
  subjects: [],
  reports: [],
  balances: [],
  suggestions: [],
  warnings: [],
  loading: false,
  error: null,
  summary: { total: 0, pending: 0, parsing: 0, reviewing: 0, revised: 0, completed: 0, exception: 0 },

  fetchVouchers: async (params) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.customer) query.append('customer', params.customer);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      const url = params ? `${API_BASE}/vouchers?${query.toString()}` : `${API_BASE}/vouchers`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取凭证列表失败');
      set({ vouchers: data });

      const summaryRes = await fetch(`${API_BASE}/vouchers/summary`);
      const summaryData = await summaryRes.json();
      set({ summary: summaryData });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchVoucher: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取凭证详情失败');
      set({ voucher: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchSubjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/subjects`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取科目列表失败');
      set({ subjects: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchReports: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/reports`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取报告列表失败');
      set({ reports: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchBalances: async (period) => {
    set({ loading: true, error: null });
    try {
      const url = period ? `${API_BASE}/balance?period=${period}` : `${API_BASE}/balance`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取余额表失败');
      set({ balances: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  getSubjectSuggestions: async (voucherId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers/${voucherId}/suggestions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取科目建议失败');
      set({ suggestions: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  checkBalanceWarnings: async (period) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/balance/check?period=${period}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取余额预警失败');
      set({ warnings: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  createVoucher: async (formData) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建凭证失败');
      return data;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  parseVoucher: async (id, operator) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers/${id}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析凭证失败');
      set({ voucher: data });
      await get().fetchVouchers();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  updateSubjectMapping: async (id, mappingId, data, operator) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers/${id}/mappings/${mappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, operator }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '更新科目映射失败');
      set({ voucher: resData });
      await get().fetchVouchers();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  addNote: async (voucherId, content, createdBy) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers/${voucherId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, createdBy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '添加备注失败');
      set({ voucher: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  completeVoucher: async (id, operator) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/vouchers/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '完成凭证失败');
      set({ voucher: data });
      await get().fetchVouchers();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  generateReport: async (period, operator) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, operator }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '生成报告失败');
      await get().fetchReports();
      return data;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  exportReport: async (reportId, format, operator) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/reports/${reportId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, operator }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '导出报告失败');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      a.download = `整理报告_${reportId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  calculateBalances: async (period) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/balance/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '计算余额失败');
      set({ balances: data });
      await get().checkBalanceWarnings(period);
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
  clearVoucher: () => set({ voucher: null }),
}));
