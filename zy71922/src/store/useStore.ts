import { create } from 'zustand';
import type { Artwork, ArtworkDetail, Stats, ImportResponse } from '../types';

interface AppState {
  artworks: Artwork[];
  currentArtwork: ArtworkDetail | null;
  stats: Stats | null;
  totalArtworks: number;
  filters: {
    status: string;
    source: string;
    disputed: boolean | null;
  };
  loading: boolean;
  fetchArtworks: (filters?: { status?: string; source?: string; disputed?: boolean | null; page?: number; limit?: number }) => Promise<void>;
  fetchArtwork: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  correctArtwork: (id: string, body: { field: string; old_value: string; new_value: string; reason: string }) => Promise<void>;
  addDispute: (id: string, body: { field: string; current_value: string; dispute_reason: string; correction_basis: string; source_reference?: string }) => Promise<void>;
  resolveDispute: (id: string) => Promise<void>;
  markChecked: (id: string) => Promise<void>;
  revertCorrection: (correctionId: string, reason: string) => Promise<void>;
  fetchCorrections: () => Promise<any[]>;
  importData: (body: { source_type: string; source_title: string; data: Record<string, unknown>[] }) => Promise<ImportResponse>;
  resolveDuplicate: (body: { duplicate_id: string; action: string; reason?: string }) => Promise<void>;
  exportData: (filters: any) => Promise<string>;
  setFilters: (filters: Partial<AppState['filters']>) => void;
}

const useStore = create<AppState>((set, get) => ({
  artworks: [],
  currentArtwork: null,
  stats: null,
  totalArtworks: 0,
  filters: { status: '', source: '', disputed: null },
  loading: false,

  fetchArtworks: async (filters) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.source) params.set('source', filters.source);
      if (filters?.disputed !== undefined && filters.disputed !== null) params.set('disputed', String(filters.disputed));
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      const res = await fetch(`/api/artworks?${params}`);
      const data = await res.json();
      if (data.success) {
        set({ artworks: data.data.items, totalArtworks: data.data.total, loading: false });
      }
    } catch (e) {
      set({ loading: false });
    }
  },

  fetchArtwork: async (id: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/artworks/${id}`);
      const data = await res.json();
      if (data.success) {
        set({ currentArtwork: data.data, loading: false });
      }
    } catch (e) {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) set({ stats: data.data });
    } catch (e) {}
  },

  correctArtwork: async (id, body) => {
    try {
      await fetch(`/api/artworks/${id}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {}
  },

  addDispute: async (id, body) => {
    try {
      await fetch(`/api/artworks/${id}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {}
  },

  resolveDispute: async (id) => {
    try {
      await fetch(`/api/disputes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });
    } catch (e) {}
  },

  markChecked: async (id) => {
    try {
      await fetch(`/api/artworks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'status', old_value: '', new_value: 'checked', reason: '人工核对完成' }),
      });
    } catch (e) {}
  },

  revertCorrection: async (correctionId, reason) => {
    try {
      await fetch(`/api/corrections/${correctionId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
    } catch (e) {}
  },

  fetchCorrections: async () => {
    try {
      const res = await fetch('/api/corrections');
      const data = await res.json();
      if (data.success) return data.data;
      return [];
    } catch (e) { return []; }
  },

  importData: async (body) => {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) return data.data;
    return { imported: 0, duplicates: [], errors: data.error ? [data.error] : [] };
  },

  resolveDuplicate: async (body) => {
    await fetch('/api/import/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  exportData: async (filters) => {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, format: 'csv' }),
    });
    const data = await res.json();
    if (data.success) return data.data.download_url;
    return '';
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));

export default useStore;
