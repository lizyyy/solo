import { create } from 'zustand';
import { Group, Bill, User, Statistics, AuditLog } from '../types';
import { api } from '../lib/api';

interface AppState {
  groups: Group[];
  selectedGroup: Group | null;
  bills: Bill[];
  selectedBill: Bill | null;
  statistics: Statistics | null;
  auditLogs: AuditLog[];
  members: User[];
  loading: boolean;
  error: string | null;

  loadGroups: () => Promise<void>;
  selectGroup: (group: Group) => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<void>;
  addMember: (groupId: string, username: string) => Promise<void>;
  removeMember: (groupId: string, memberId: string) => Promise<void>;

  loadBills: (groupId: string) => Promise<void>;
  loadBill: (billId: string) => Promise<Bill>;
  createBill: (data: any) => Promise<Bill>;
  updateBill: (billId: string, data: any) => Promise<Bill>;
  deleteBill: (billId: string) => Promise<void>;
  settleBill: (billId: string) => Promise<Bill>;

  loadStatistics: (groupId: string) => Promise<void>;
  loadAuditLogs: (groupId: string) => Promise<void>;
  exportReport: (groupId: string) => Promise<void>;

  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  groups: [],
  selectedGroup: null,
  bills: [],
  selectedBill: null,
  statistics: null,
  auditLogs: [],
  members: [],
  loading: false,
  error: null,

  loadGroups: async () => {
    set({ loading: true, error: null });
    try {
      const groups = await api.get<Group[]>('/groups');
      set({ groups, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '加载分组失败',
        loading: false,
      });
    }
  },

  selectGroup: async (group) => {
    set({ selectedGroup: group });
    await Promise.all([
      get().loadBills(group.id),
      get().loadStatistics(group.id),
      get().loadAuditLogs(group.id),
    ]);
  },

  createGroup: async (name, description) => {
    set({ loading: true, error: null });
    try {
      const newGroup = await api.post<Group>('/groups', { name, description });
      set((state) => ({
        groups: [...state.groups, newGroup],
        loading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '创建分组失败',
        loading: false,
      });
      throw error;
    }
  },

  addMember: async (groupId, username) => {
    set({ loading: true, error: null });
    try {
      await api.post(`/groups/${groupId}/members`, { username });
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '添加成员失败',
        loading: false,
      });
      throw error;
    }
  },

  removeMember: async (groupId, memberId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/groups/${groupId}/members/${memberId}`);
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '移除成员失败',
        loading: false,
      });
      throw error;
    }
  },

  loadBills: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const bills = await api.get<Bill[]>(`/bills/group/${groupId}`);
      const members = await api.get<User[]>(`/groups/${groupId}/members`);
      set({ bills, members, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '加载账单失败',
        loading: false,
      });
    }
  },

  loadBill: async (billId) => {
    const bill = await api.get<Bill>(`/bills/${billId}`);
    set({ selectedBill: bill });
    return bill;
  },

  createBill: async (data) => {
    set({ loading: true, error: null });
    try {
      const bill = await api.post<Bill>('/bills', data, { idempotent: true });
      const selectedGroup = get().selectedGroup;
      if (selectedGroup) {
        await get().loadBills(selectedGroup.id);
      }
      set({ loading: false });
      return bill;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '创建账单失败',
        loading: false,
      });
      throw error;
    }
  },

  updateBill: async (billId, data) => {
    set({ loading: true, error: null });
    try {
      const bill = await api.put<Bill>(`/bills/${billId}`, data);
      const selectedGroup = get().selectedGroup;
      if (selectedGroup) {
        await get().loadBills(selectedGroup.id);
      }
      set({ selectedBill: bill, loading: false });
      return bill;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '更新账单失败',
        loading: false,
      });
      throw error;
    }
  },

  deleteBill: async (billId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/bills/${billId}`);
      const selectedGroup = get().selectedGroup;
      if (selectedGroup) {
        await get().loadBills(selectedGroup.id);
      }
      set({ selectedBill: null, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '删除账单失败',
        loading: false,
      });
      throw error;
    }
  },

  settleBill: async (billId) => {
    set({ loading: true, error: null });
    try {
      const bill = await api.post<Bill>(`/bills/${billId}/settle`);
      const selectedGroup = get().selectedGroup;
      if (selectedGroup) {
        await get().loadBills(selectedGroup.id);
      }
      set({ loading: false });
      return bill;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '结算账单失败',
        loading: false,
      });
      throw error;
    }
  },

  loadStatistics: async (groupId) => {
    try {
      const stats = await api.get<Statistics>(`/bills/statistics/${groupId}`);
      set({ statistics: stats });
    } catch (error: any) {
      console.error('加载统计失败:', error);
    }
  },

  loadAuditLogs: async (groupId) => {
    try {
      const response = await api.get<{ logs: AuditLog[] }>(`/audit/group/${groupId}`);
      set({ auditLogs: response.logs });
    } catch (error: any) {
      console.error('加载审计日志失败:', error);
    }
  },

  exportReport: async (groupId) => {
    try {
      const date = new Date().toISOString().split('T')[0];
      await api.download(`/reports/group/${groupId}/excel`, `账单报告_${date}.xlsx`);
    } catch (error: any) {
      set({
        error: error.message || '导出报告失败',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
