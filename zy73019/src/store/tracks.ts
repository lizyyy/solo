import { create } from 'zustand';
import type { Track, TimelineNode } from '../../shared/types';
import {
  listTracks,
  getTrack,
  createTrack as apiCreateTrack,
  reviseTrack as apiReviseTrack,
  getTimeline as apiGetTimeline,
  getHandoff as apiGetHandoff,
} from '@/api/client';

interface TrackFilter {
  search: string;
  status: string;
  sortBy: string;
}

interface TracksState {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  currentTrack: Track | null;
  timeline: TimelineNode[];
  handoff: string;
  filter: TrackFilter;
  fetchList: () => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  fetchTimeline: (id: string) => Promise<void>;
  fetchHandoff: (id: string) => Promise<void>;
  create: (payload: any) => Promise<void>;
  revise: (id: string, payload: any) => Promise<void>;
  setFilter: (filter: Partial<TrackFilter>) => void;
}

export const useTracksStore = create<TracksState>((set, get) => ({
  tracks: [],
  loading: false,
  error: null,
  currentTrack: null,
  timeline: [],
  handoff: '',
  filter: {
    search: '',
    status: '',
    sortBy: 'createdAt',
  },

  fetchList: async () => {
    set({ loading: true, error: null });
    try {
      const { filter } = get();
      const result = await listTracks({
        search: filter.search || undefined,
        status: filter.status || undefined,
        sortBy: filter.sortBy || undefined,
      });
      set({ tracks: result.data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchDetail: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const result = await getTrack(id);
      set({ currentTrack: result.data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchTimeline: async (id: string) => {
    try {
      const result = await apiGetTimeline(id);
      set({ timeline: result.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchHandoff: async (id: string) => {
    try {
      const result = await apiGetHandoff(id);
      set({ handoff: result.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  create: async (payload: any) => {
    set({ loading: true, error: null });
    try {
      await apiCreateTrack(payload);
      set({ loading: false });
      await get().fetchList();
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  revise: async (id: string, payload: any) => {
    set({ loading: true, error: null });
    try {
      await apiReviseTrack(id, payload);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  setFilter: (filter: Partial<TrackFilter>) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
  },
}));
