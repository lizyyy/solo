import { create } from 'zustand';
import { ReturnApplication, ReturnStatus, StatusTransition, PaginatedResponse } from '../../shared/types';

interface ReturnState {
  applications: ReturnApplication[];
  currentApplication: ReturnApplication | null;
  stats: any;
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  
  fetchApplications: (status?: ReturnStatus) => Promise<void>;
  fetchApplication: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  createApplication: (data: Partial<ReturnApplication>) => Promise<ReturnApplication | null>;
  submitApplication: (id: string) => Promise<boolean>;
  updateStatus: (id: string, status: ReturnStatus, reason?: string) => Promise<boolean>;
  fetchTransitions: (id: string) => Promise<StatusTransition[]>;
  setPage: (page: number) => void;
}

export const useReturnStore = create<ReturnState>((set, get) => ({
  applications: [],
  currentApplication: null,
  stats: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  pageSize: 10,

  fetchApplications: async (status?: ReturnStatus) => {
    set({ loading: true, error: null });
    try {
      const { page, pageSize } = get();
      let url = `/api/returns?page=${page}&pageSize=${pageSize}`;
      if (status) {
        url += `&status=${status}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        set({
          applications: data.data.data,
          total: data.data.total,
          loading: false
        });
      } else {
        set({ error: data.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchApplication: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/returns/${id}`);
      const data = await res.json();
      if (data.success) {
        set({ currentApplication: data.data, loading: false });
      } else {
        set({ error: data.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/returns/stats');
      const data = await res.json();
      if (data.success) {
        set({ stats: data.data, loading: false });
      } else {
        set({ error: data.message, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createApplication: async (data: Partial<ReturnApplication>) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        set({ loading: false });
        return result.data;
      } else {
        set({ error: result.message, loading: false });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  submitApplication: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/returns/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        set(state => ({
          currentApplication: data.data,
          applications: state.applications.map(a =>
            a.id === id ? data.data : a
          ),
          loading: false
        }));
        return true;
      } else {
        set({ error: data.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  updateStatus: async (id: string, status: ReturnStatus, reason?: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/returns/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });
      const data = await res.json();
      if (data.success) {
        set(state => ({
          currentApplication: data.data,
          applications: state.applications.map(a =>
            a.id === id ? data.data : a
          ),
          loading: false
        }));
        return true;
      } else {
        set({ error: data.message, loading: false });
        return false;
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  fetchTransitions: async (id: string) => {
    try {
      const res = await fetch(`/api/returns/${id}/transitions`);
      const data = await res.json();
      if (data.success) {
        return data.data;
      }
      return [];
    } catch (err: any) {
      return [];
    }
  },

  setPage: (page: number) => set({ page })
}));
