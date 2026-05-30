import { create } from 'zustand';
import {
  tracks as tracksApi,
  votes as votesApi,
  copyright as copyrightApi,
  decisions as decisionsApi,
  audit as auditApi,
  badData as badDataApi,
  stats as statsApi,
} from '../api/client.js';
import type {
  TrackWithRelations,
  Vote,
  Copyright,
  Decision,
  AuditLog,
  BadDataRecord,
  Stats,
  FilterCriteria,
  DedupeRule,
  Track,
} from '../types/index.js';

interface AppState {
  tracks: TrackWithRelations[];
  votes: Vote[];
  copyrights: Copyright[];
  decisions: Decision[];
  currentDecision: Decision | null;
  selectedTrackIds: string[];
  filters: FilterCriteria;
  dedupeRules: DedupeRule[];
  auditLogs: AuditLog[];
  badData: BadDataRecord[];
  stats: Stats | null;
  loading: boolean;
  error: string | null;

  fetchTracks: () => Promise<void>;
  fetchVotes: () => Promise<void>;
  fetchCopyrights: () => Promise<void>;
  fetchDecisions: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;
  fetchBadData: () => Promise<void>;
  fetchStats: () => Promise<void>;

  createTrack: (data: Omit<Track, 'id' | 'createdAt' | 'updatedAt' | 'source'>) => Promise<void>;
  updateTrack: (id: string, data: Partial<Omit<Track, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;

  importVotes: (file: File) => Promise<void>;
  importCopyrights: (file: File) => Promise<void>;

  toggleTrack: (trackId: string) => void;
  setFilters: (filters: Partial<FilterCriteria>) => void;
  setDedupeRules: (rules: DedupeRule[]) => void;

  saveDecision: (name: string, reason?: string) => Promise<void>;
  loadDecision: (id: string) => Promise<void>;
  exportDecision: (id: string) => Promise<void>;

  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tracks: [],
  votes: [],
  copyrights: [],
  decisions: [],
  currentDecision: null,
  selectedTrackIds: [],
  filters: {},
  dedupeRules: [
    { field: 'voterId', enabled: true },
    { field: 'voterName', enabled: true },
    { field: 'trackName', enabled: false },
  ],
  auditLogs: [],
  badData: [],
  stats: null,
  loading: false,
  error: null,

  fetchTracks: async () => {
    try {
      set({ loading: true, error: null });
      const data = await tracksApi.getTracks();
      set({ tracks: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载曲目列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchVotes: async () => {
    try {
      set({ loading: true, error: null });
      const data = await votesApi.getVotes();
      set({ votes: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载投票数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchCopyrights: async () => {
    try {
      set({ loading: true, error: null });
      const data = await copyrightApi.getCopyrights();
      set({ copyrights: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载版权数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchDecisions: async () => {
    try {
      set({ loading: true, error: null });
      const data = await decisionsApi.getDecisions();
      set({ decisions: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载决策历史失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchAuditLogs: async () => {
    try {
      set({ loading: true, error: null });
      const data = await auditApi.getAuditLogs();
      set({ auditLogs: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载审计日志失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchBadData: async () => {
    try {
      set({ loading: true, error: null });
      const data = await badDataApi.getBadData();
      set({ badData: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载坏数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const { selectedTrackIds, currentDecision } = get();
      const data = await statsApi.getStats(selectedTrackIds, currentDecision?.id);
      set({ stats: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '计算统计数据失败' });
    }
  },

  createTrack: async (data) => {
    try {
      set({ loading: true, error: null });
      await tracksApi.createTrack(data);
      await get().fetchTracks();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '创建曲目失败' });
    } finally {
      set({ loading: false });
    }
  },

  updateTrack: async (id, data) => {
    try {
      set({ loading: true, error: null });
      await tracksApi.updateTrack(id, data);
      await get().fetchTracks();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新曲目失败' });
    } finally {
      set({ loading: false });
    }
  },

  deleteTrack: async (id) => {
    try {
      set({ loading: true, error: null });
      await tracksApi.deleteTrack(id);
      await get().fetchTracks();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除曲目失败' });
    } finally {
      set({ loading: false });
    }
  },

  importVotes: async (file) => {
    try {
      set({ loading: true, error: null });
      await votesApi.importVotes(file);
      await Promise.all([get().fetchVotes(), get().fetchBadData()]);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导入投票数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  importCopyrights: async (file) => {
    try {
      set({ loading: true, error: null });
      await copyrightApi.importCopyrights(file);
      await Promise.all([get().fetchCopyrights(), get().fetchBadData()]);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导入版权数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  toggleTrack: (trackId) => {
    const { selectedTrackIds } = get();
    const newSelectedIds = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId];
    set({ selectedTrackIds: newSelectedIds });
    get().fetchStats();
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setDedupeRules: (rules) => {
    set({ dedupeRules: rules });
  },

  saveDecision: async (name, reason) => {
    try {
      set({ loading: true, error: null });
      const { selectedTrackIds, filters, dedupeRules } = get();
      const newDecision = await decisionsApi.createDecision({
        name,
        selectedTrackIds,
        filters,
        deduplicationRules: dedupeRules,
        decisionReason: reason,
      });
      set({ currentDecision: newDecision });
      await get().fetchDecisions();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '保存决策失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadDecision: async (id) => {
    try {
      set({ loading: true, error: null });
      const decision = await decisionsApi.getDecision(id);
      set({
        currentDecision: decision,
        selectedTrackIds: decision.selectedTrackIds,
        filters: decision.filters,
        dedupeRules: decision.deduplicationRules,
      });
      await get().fetchStats();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载决策失败' });
    } finally {
      set({ loading: false });
    }
  },

  exportDecision: async (id) => {
    try {
      set({ loading: true, error: null });
      const blob = await decisionsApi.exportDecision(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decision-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出决策失败' });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
