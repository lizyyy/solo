import { create } from 'zustand';
import type {
  EvidencePack,
  EvidencePackDetail,
  JudgmentResult,
  ReviewRecord,
  StatData,
} from '../types';
import {
  db,
  initMockData,
  getPackWithDetail,
  getStats,
  addReviewRecord,
  updatePackStatus,
} from '../db';

interface AppState {
  packs: EvidencePack[];
  currentPack: EvidencePackDetail | null;
  stats: StatData;
  isLoading: boolean;
  error: string | null;
  
  initApp: () => Promise<void>;
  loadPacks: () => Promise<void>;
  loadPackDetail: (packId: string) => Promise<void>;
  loadStats: () => Promise<void>;
  addReview: (review: ReviewRecord) => Promise<void>;
  setPackStatus: (packId: string, status: string) => Promise<void>;
  clearCurrentPack: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  packs: [],
  currentPack: null,
  stats: { total: 0, pending: 0, reviewing: 0, completed: 0, abnormal: 0 },
  isLoading: false,
  error: null,

  initApp: async () => {
    set({ isLoading: true, error: null });
    try {
      await initMockData();
      await Promise.all([
        get().loadPacks(),
        get().loadStats(),
      ]);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '初始化失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadPacks: async () => {
    set({ isLoading: true });
    try {
      const packs = await db.packs.orderBy('importedAt').reverse().toArray();
      set({ packs });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadPackDetail: async (packId: string) => {
    set({ isLoading: true });
    try {
      const detail = await getPackWithDetail(packId);
      set({ currentPack: detail });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载详情失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadStats: async () => {
    try {
      const stats = await getStats();
      set({ stats });
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  },

  addReview: async (review: ReviewRecord) => {
    set({ isLoading: true });
    try {
      await addReviewRecord(review);
      await get().loadPackDetail(review.packId);
      await get().loadPacks();
      await get().loadStats();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加复核记录失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  setPackStatus: async (packId: string, status: string) => {
    try {
      await updatePackStatus(packId, status);
      await get().loadPacks();
      await get().loadPackDetail(packId);
      await get().loadStats();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新状态失败' });
    }
  },

  clearCurrentPack: () => {
    set({ currentPack: null });
  },
}));
