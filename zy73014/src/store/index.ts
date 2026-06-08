import { create } from 'zustand';
import { MOCK_AUDIT_LOGS, MOCK_FOLLOW_UPS, MOCK_FOSTERS } from '@/data/mockData';
import type { AuditLog, FollowUpRecord, FollowUpStatus } from '@/types';

export type FilterKey =
  | 'all'
  | FollowUpStatus;

interface State {
  fosters: typeof MOCK_FOSTERS;
  records: FollowUpRecord[];
  auditLogs: AuditLog[];
  selectedRecordId: string | null;
  activeFilter: FilterKey;
  keyword: string;
};

interface Actions {
  setSelectedRecordId: (id: string | null) => void;
  setActiveFilter: (f: FilterKey) => void;
  setKeyword: (k: string) => void;
  updateRecordStatus: (
    id: string,
    next: FollowUpStatus,
    meta: {
      operatorName: string;
      remark?: string;
      reason?: string;
    },
  ) => void;
  confirmPendingRecord: (
    id: string,
    resolve: {
      status: FollowUpStatus;
      operatorName: string;
      remark?: string;
      reason?: string;
    },
  ) => void;
}

export const useStore = create<State & Actions>((set) => ({
  fosters: MOCK_FOSTERS,
  records: MOCK_FOLLOW_UPS,
  auditLogs: MOCK_AUDIT_LOGS,
  selectedRecordId: null,
  activeFilter: 'all',
  keyword: '',

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),
  setActiveFilter: (f) => set({ activeFilter: f }),
  setKeyword: (k) => set({ keyword: k }),

  updateRecordStatus: (id, next, meta) =>
    set((s) => {
      const prev = s.records.find((r) => r.id === id);
      if (!prev) return {};
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const updated: FollowUpRecord = {
        ...prev,
        status: next,
        remark: meta.remark ?? prev.remark,
        updatedAt: ts,
      };
      const log: AuditLog = {
        id: `LOG-${id}-${Date.now()}`,
        recordId: id,
        operator: '复核人',
        operatorName: meta.operatorName,
        action: 'update_status',
        oldSnapshot: { status: prev.status, remark: prev.remark },
        newSnapshot: { status: next, remark: meta.remark ?? prev.remark },
        remark: meta.remark,
        reason: meta.reason,
        timestamp: ts,
      };
      return {
        records: s.records.map((r) => (r.id === id ? updated : r)),
        auditLogs: [...s.auditLogs, log],
      };
    }),

  confirmPendingRecord: (id, resolve) =>
    set((s) => {
      const prev = s.records.find((r) => r.id === id);
      if (!prev) return {};
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const updated: FollowUpRecord = {
        ...prev,
        status: resolve.status,
        weightUnitMixed: false,
        abnormalTypes: prev.abnormalTypes.filter((t) => t !== 'weight_unit_mixed'),
        remark: resolve.remark ?? prev.remark,
        updatedAt: ts,
      };
      const log: AuditLog = {
        id: `LOG-${id}-${Date.now()}`,
        recordId: id,
        operator: '算法值班人',
        operatorName: resolve.operatorName,
        action: 'confirm_pending',
        oldSnapshot: {
          status: prev.status,
          weightUnitMixed: prev.weightUnitMixed,
          abnormalTypes: prev.abnormalTypes,
          remark: prev.remark,
        },
        newSnapshot: {
          status: resolve.status,
          weightUnitMixed: false,
          abnormalTypes: updated.abnormalTypes,
          remark: resolve.remark,
        },
        remark: resolve.remark,
        reason: resolve.reason,
        timestamp: ts,
      };
      return {
        records: s.records.map((r) => (r.id === id ? updated : r)),
        auditLogs: [...s.auditLogs, log],
      };
    }),
}));
