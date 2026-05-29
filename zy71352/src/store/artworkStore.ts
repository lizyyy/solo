import { create } from 'zustand';
import type {
  Artwork,
  ArtworkDetail,
  ReportSummary,
  RecordStatus,
} from '../../shared/types';
import api from '../services/api';

interface ArtworkState {
  artworks: Artwork[];
  artworkDetail: ArtworkDetail | null;
  reportSummary: ReportSummary | null;
  loading: boolean;
  error: string | null;
  total: number;
  filters: {
    status?: RecordStatus;
    search?: string;
    page: number;
    pageSize: number;
  };
  selectedStatus: RecordStatus | 'all';
}

interface ArtworkActions {
  fetchArtworks: () => Promise<void>;
  fetchArtworkDetail: (id: string) => Promise<void>;
  fetchReportSummary: () => Promise<void>;
  createArtwork: (
    data: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ) => Promise<boolean>;
  updateArtwork: (
    id: string,
    data: Partial<Omit<Artwork, 'id' | 'createdAt'>>
  ) => Promise<boolean>;
  updateArtworkStatus: (
    id: string,
    status: RecordStatus,
    reason?: string
  ) => Promise<boolean>;
  setFilters: (
    filters: Partial<ArtworkState['filters']>
  ) => void;
  setSelectedStatus: (status: RecordStatus | 'all') => void;
  clearDetail: () => void;
  clearError: () => void;
}

const initialFilters: ArtworkState['filters'] = {
  page: 1,
  pageSize: 20,
};

export const useArtworkStore = create<ArtworkState & ArtworkActions>((set, get) => ({
  artworks: [],
  artworkDetail: null,
  reportSummary: null,
  loading: false,
  error: null,
  total: 0,
  filters: initialFilters,
  selectedStatus: 'all',

  fetchArtworks: async () => {
    set({ loading: true, error: null });
    try {
      const { filters, selectedStatus } = get();
      const params = {
    ...filters,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
  };
      const response = await api.artwork.getList(params);
      if (response.success && response.data) {
    set({
      artworks: response.data.artworks,
      total: response.data.total,
    });
  } else {
    set({ error: response.error || '获取作品列表失败' });
  }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '获取作品列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchArtworkDetail: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await api.artwork.getDetail(id);
      if (response.success && response.data) {
    set({ artworkDetail: response.data });
  } else {
    set({ error: response.error || '获取作品详情失败' });
  }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '获取作品详情失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchReportSummary: async () => {
    try {
      const response = await api.report.getSummary();
      if (response.success && response.data) {
    set({ reportSummary: response.data });
  }
    } catch (err) {
      console.error('获取报告摘要失败:', err);
    }
  },

  createArtwork: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await api.artwork.create(data);
      if (response.success) {
    await get().fetchArtworks();
    return true;
  }
      set({ error: response.error || '创建作品失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '创建作品失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateArtwork: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const response = await api.artwork.update(id, { ...data, operator: '策展助理-李娜' });
      if (response.success) {
    await get().fetchArtworkDetail(id);
    await get().fetchArtworks();
    return true;
  }
      set({ error: response.error || '更新作品失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '更新作品失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateArtworkStatus: async (id, status, reason) => {
    set({ loading: true, error: null });
    try {
      const response = await api.artwork.updateStatus(id, status, reason, '策展助理-李娜');
      if (response.success) {
    await get().fetchArtworkDetail(id);
    await get().fetchArtworks();
    await get().fetchReportSummary();
    return true;
  }
      set({ error: response.error || '更新状态失败' });
      return false;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '更新状态失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
    get().fetchArtworks();
  },

  setSelectedStatus: (status) => {
    set({ selectedStatus: status });
    get().fetchArtworks();
  },

  clearDetail: () => {
    set({ artworkDetail: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
