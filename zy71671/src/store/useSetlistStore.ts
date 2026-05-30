import { create } from 'zustand';
import type { Setlist, Song, CheckReport } from '../../shared/types';
import { setlistApi, songApi, validationApi, reportApi, versionApi, traceApi } from '../lib/api';

interface SetlistStore {
  setlists: Setlist[];
  currentSetlist: (Setlist & { songs: Song[] }) | null;
  currentReport: CheckReport | null;
  reportHistory: CheckReport[];
  loading: boolean;
  error: string | null;

  fetchSetlists: () => Promise<void>;
  fetchSetlist: (id: string) => Promise<void>;
  createSetlist: (data: Parameters<typeof setlistApi.create>[0]) => Promise<Setlist>;
  updateSetlist: (id: string, data: Parameters<typeof setlistApi.update>[1]) => Promise<void>;
  addSong: (setlistId: string, data: Parameters<typeof songApi.create>[1]) => Promise<void>;
  updateSong: (setlistId: string, songId: string, data: Parameters<typeof songApi.update>[2]) => Promise<void>;
  validateSetlist: (setlistId: string) => ReturnType<typeof validationApi.validate>;
  generateReport: (setlistId: string) => Promise<CheckReport>;
  fetchReport: (setlistId: string) => Promise<void>;
  fetchReportHistory: (setlistId: string) => Promise<void>;
  exportReport: (setlistId: string, format: 'json' | 'csv') => Promise<void>;
  traceField: (setlistId: string, field: string) => ReturnType<typeof traceApi.traceField>;
  getBreakdown: (setlistId: string, field: string) => ReturnType<typeof traceApi.getBreakdown>;
  clearCurrent: () => void;
}

export const useSetlistStore = create<SetlistStore>((set, get) => ({
  setlists: [],
  currentSetlist: null,
  currentReport: null,
  reportHistory: [],
  loading: false,
  error: null,

  fetchSetlists: async () => {
    set({ loading: true, error: null });
    try {
      const data = await setlistApi.list();
      set({ setlists: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取歌单列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchSetlist: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const data = await setlistApi.get(id, true);
      set({ currentSetlist: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取歌单详情失败' });
    } finally {
      set({ loading: false });
    }
  },

  createSetlist: async (data) => {
    set({ loading: true, error: null });
    try {
      const setlist = await setlistApi.create(data);
      set((state) => ({ setlists: [setlist, ...state.setlists] }));
      return setlist;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '创建歌单失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateSetlist: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const updated = await setlistApi.update(id, data);
      set((state) => ({
        setlists: state.setlists.map((s) => (s.id === id ? updated : s)),
        currentSetlist: state.currentSetlist?.id === id ? { ...state.currentSetlist, ...updated } : state.currentSetlist,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新歌单失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  addSong: async (setlistId, data) => {
    set({ loading: true, error: null });
    try {
      const song = await songApi.create(setlistId, data);
      set((state) => {
        if (state.currentSetlist?.id === setlistId) {
          return {
            currentSetlist: {
              ...state.currentSetlist,
              songs: [...state.currentSetlist.songs, song].sort((a, b) => a.order - b.order),
            },
          };
        }
        return state;
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加歌曲失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateSong: async (setlistId, songId, data) => {
    set({ loading: true, error: null });
    try {
      const song = await songApi.update(setlistId, songId, data);
      set((state) => {
        if (state.currentSetlist?.id === setlistId) {
          return {
            currentSetlist: {
              ...state.currentSetlist,
              songs: state.currentSetlist.songs.map((s) => (s.id === songId ? song : s)),
            },
          };
        }
        return state;
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新歌曲失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  validateSetlist: async (setlistId) => {
    set({ loading: true, error: null });
    try {
      const result = await validationApi.validate(setlistId);
      return result;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '校验失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  generateReport: async (setlistId) => {
    set({ loading: true, error: null });
    try {
      const report = await reportApi.generate(setlistId);
      set({ currentReport: report });
      return report;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '生成报告失败' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchReport: async (setlistId) => {
    set({ loading: true, error: null });
    try {
      const report = await reportApi.get(setlistId);
      set({ currentReport: report });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取报告失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchReportHistory: async (setlistId) => {
    set({ loading: true, error: null });
    try {
      const history = await reportApi.history(setlistId);
      set({ reportHistory: history });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取报告历史失败' });
    } finally {
      set({ loading: false });
    }
  },

  exportReport: async (setlistId, format) => {
    try {
      const response = await reportApi.export(setlistId, format);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `setlist-report-${setlistId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出报告失败' });
      throw error;
    }
  },

  traceField: async (setlistId, field) => {
    return traceApi.traceField(setlistId, field);
  },

  getBreakdown: async (setlistId, field) => {
    return traceApi.getBreakdown(setlistId, field);
  },

  clearCurrent: () => {
    set({ currentSetlist: null, currentReport: null, reportHistory: [] });
  },
}));

export default useSetlistStore;
