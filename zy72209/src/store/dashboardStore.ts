import { create } from 'zustand';
import type { CreditRecord, SelfCheckResult, ImportResult, ConflictEvidence } from '../../shared/types';

interface DashboardStore {
  records: CreditRecord[];
  dataHash: string;
  loading: boolean;
  error: string | null;

  filters: {
    status: string[];
    hasConflict: boolean | null;
    nameConsistent: boolean | null;
    searchText: string;
  };

  selfCheckResults: SelfCheckResult[];
  selfCheckRunning: boolean;

  detailRecord: CreditRecord | null;
  conflictRecord: CreditRecord | null;
  supplementRecord: CreditRecord | null;
  showImportModal: boolean;

  fetchRecords: () => Promise<void>;
  setFilters: (filters: Partial<DashboardStore['filters']>) => void;
  setDetailRecord: (record: CreditRecord | null) => void;
  setConflictRecord: (record: CreditRecord | null) => void;
  setSupplementRecord: (record: CreditRecord | null) => void;
  setShowImportModal: (show: boolean) => void;

  runSelfCheck: (checks?: string) => Promise<void>;
  importCustodian: (data: any[]) => Promise<ImportResult | null>;
  uploadScreenshot: (id: string, screenshotData: any) => Promise<{ hasConflict: boolean; conflicts: ConflictEvidence[] } | null>;
  resolveConflict: (id: string, resolution: 'confirm_custodian' | 'reject_use_screenshot', remark: string) => Promise<boolean>;
  supplementRecordAction: (id: string, fields: Record<string, any>) => Promise<boolean>;
  addRemark: (id: string, content: string) => Promise<boolean>;
  exportData: () => Promise<void>;
  verifyExportConsistency: () => Promise<boolean>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  records: [],
  dataHash: '',
  loading: false,
  error: null,

  filters: {
    status: [],
    hasConflict: null,
    nameConsistent: null,
    searchText: ''
  },

  selfCheckResults: [],
  selfCheckRunning: false,

  detailRecord: null,
  conflictRecord: null,
  supplementRecord: null,
  showImportModal: false,

  fetchRecords: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/records');
      const data = await res.json();
      if (data.success) {
        set({ records: data.data, dataHash: data.dataHash, loading: false });
      } else {
        set({ error: data.message, loading: false });
      }
    } catch (err) {
      set({ error: '获取数据失败', loading: false });
    }
  },

  setFilters: (filters) => {
    set(state => ({ filters: { ...state.filters, ...filters } }));
  },

  setDetailRecord: (record) => {
    set({ detailRecord: record });
  },

  setConflictRecord: (record) => {
    set({ conflictRecord: record });
  },

  setSupplementRecord: (record) => {
    set({ supplementRecord: record });
  },

  setShowImportModal: (show) => {
    set({ showImportModal: show });
  },

  runSelfCheck: async (checks) => {
    set({ selfCheckRunning: true });
    try {
      const url = checks ? `/api/self-check?checks=${checks}` : '/api/self-check';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        set({ selfCheckResults: data.data, selfCheckRunning: false });
      }
    } catch (err) {
      set({ selfCheckRunning: false });
    }
  },

  importCustodian: async (importData) => {
    try {
      const res = await fetch('/api/records/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: importData, fileName: 'manual_import' })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchRecords();
        return data.data;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  uploadScreenshot: async (id, screenshotData) => {
    try {
      const res = await fetch(`/api/records/${id}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshotData })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchRecords();
        return data.data;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  resolveConflict: async (id, resolution, remark) => {
    try {
      const res = await fetch(`/api/records/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, remark })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchRecords();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  supplementRecordAction: async (id, fields) => {
    try {
      const res = await fetch(`/api/records/${id}/supplement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchRecords();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  addRemark: async (id, content) => {
    try {
      const res = await fetch(`/api/records/${id}/remark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchRecords();
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  exportData: async () => {
    try {
      const res = await fetch('/api/export/excel');
      if (!res.ok) throw new Error(`导出请求失败: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      a.download = match ? decodeURIComponent(match[1]) : `授信额度明细_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败', err);
    }
  },

  verifyExportConsistency: async () => {
    try {
      const { dataHash } = get();
      const res = await fetch(`/api/export/verify?pageHash=${dataHash}`);
      const data = await res.json();
      return data.data?.isConsistent ?? false;
    } catch (err) {
      return false;
    }
  }
}));
