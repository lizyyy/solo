import { create } from 'zustand';
import type { Clip, ClipStatus, User, ExportManifest } from 'shared/types';
import { api } from '@/api/client';
import { DEFAULT_OPERATOR_ID } from 'shared/constants';

interface ClipStore {
  clips: Clip[];
  currentClip: Clip | null;
  users: User[];
  exportManifest: ExportManifest | null;
  loading: boolean;
  error: string | null;
  filters: {
    status?: ClipStatus;
    keyword?: string;
  };
  selectedClipIds: string[];

  fetchClips: () => Promise<void>;
  fetchClip: (id: string) => Promise<void>;
  fetchUsers: () => Promise<void>;
  setFilters: (filters: Partial<{ status?: ClipStatus; keyword?: string }>) => void;
  toggleClipSelection: (id: string) => void;
  clearSelection: () => void;
  createClip: (data: Parameters<typeof api.clips.create>['0']) => Promise<Clip | null>;
  updateClip: (id: string, data: Parameters<typeof api.clips.update>['1']) => Promise<Clip | null>;
  updateStatus: (id: string, data: Parameters<typeof api.clips.updateStatus>['1']) => Promise<Clip | null>;
  checkExport: (clipIds: string[]) => Promise<void>;
  addMaterial: (clipId: string, data: Parameters<typeof api.clips.addMaterial>['1']) => Promise<void>;
  clearError: () => void;
}

export const useClipStore = create<ClipStore>((set, get) => ({
  clips: [],
  currentClip: null,
  users: [],
  exportManifest: null,
  loading: false,
  error: null,
  filters: {},
  selectedClipIds: [],

  fetchClips: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const clips = await api.clips.list(filters);
      set({ clips, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchClip: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const clip = await api.clips.get(id);
      set({ currentClip: clip, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchUsers: async () => {
    try {
      const users = await api.users.list();
      set({ users });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setFilters: (filters) => {
    set({ filters });
  },

  toggleClipSelection: (id) => {
    const { selectedClipIds } = get();
    const newSelection = selectedClipIds.includes(id)
      ? selectedClipIds.filter(i => i !== id)
      : [...selectedClipIds, id];
    set({ selectedClipIds: newSelection });
  },

  clearSelection: () => {
    set({ selectedClipIds: [] });
  },

  createClip: async (data) => {
    set({ loading: true, error: null });
    try {
      const clip = await api.clips.create({ ...data, operatorId: DEFAULT_OPERATOR_ID });
      await get().fetchClips();
      set({ loading: false });
      return clip;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updateClip: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const clip = await api.clips.update(id, { ...data, operatorId: DEFAULT_OPERATOR_ID });
      await get().fetchClips();
      if (get().currentClip?.id === id) {
        set({ currentClip: clip });
      }
      set({ loading: false });
      return clip;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  updateStatus: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const clip = await api.clips.updateStatus(id, { ...data, operatorId: DEFAULT_OPERATOR_ID });
      await get().fetchClips();
      if (get().currentClip?.id === id) {
        set({ currentClip: clip });
      }
      set({ loading: false });
      return clip;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  checkExport: async (clipIds) => {
    set({ loading: true, error: null });
    try {
      const manifest = await api.export.check(clipIds, DEFAULT_OPERATOR_ID);
      set({ exportManifest: manifest, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addMaterial: async (clipId, data) => {
    set({ loading: true, error: null });
    try {
      await api.clips.addMaterial(clipId, { ...data, operatorId: DEFAULT_OPERATOR_ID });
      await get().fetchClip(clipId);
      await get().fetchClips();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
