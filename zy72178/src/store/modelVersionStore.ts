import { create } from 'zustand';
import { getAllFromStore, getFromStore, putToStore, deleteFromStore } from '../db';
import { createModelVersion as createModelVersionService } from '../services/checkupEngine';
import type { ModelVersion } from '../types';
import { generateUUID } from '../utils/crypto';
import { useAppStore } from './appStore';

interface ModelVersionState {
  versions: ModelVersion[];
  activeVersionId: string | null;
  loading: boolean;
  error: string | null;
  fetchVersions: () => Promise<void>;
  createVersion: (data: Omit<ModelVersion, 'id' | 'createdAt' | 'createdBy' | 'isActive'>) => Promise<ModelVersion>;
  addVersion: (data: Partial<ModelVersion>) => Promise<ModelVersion>;
  updateVersion: (id: string, data: Partial<ModelVersion>) => Promise<void>;
  deleteVersion: (id: string) => Promise<void>;
  setActiveVersion: (id: string | null) => Promise<void>;
  getVersion: (id: string) => ModelVersion | undefined;
}

export const useModelVersionStore = create<ModelVersionState>((set, get) => ({
  versions: [],
  activeVersionId: null,
  loading: false,
  error: null,
  fetchVersions: async () => {
    set({ loading: true, error: null });
    try {
      const versions = await getAllFromStore('modelVersions', 'by-createdAt', 'prev');
      set({ versions, loading: false });
      if (versions.length > 0 && !get().activeVersionId) {
        const active = versions.find(v => v.isActive) || versions[0];
        set({ activeVersionId: active.id });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  createVersion: async (data) => {
    set({ loading: true, error: null });
    try {
      const version = await createModelVersionService(data);
      await get().fetchVersions();
      return version;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  addVersion: async (data) => {
    set({ loading: true, error: null });
    const currentUser = useAppStore.getState().currentUser;
    try {
      const now = new Date().toISOString();
      const version: ModelVersion = {
        id: generateUUID(),
        name: data.name || '',
        version: data.version || '',
        description: data.description || '',
        config: data.config || { threshold: 0.7, topK: 3, modelType: 'rag' },
        createdAt: now,
        createdBy: currentUser,
        isActive: false,
      };
      await putToStore('modelVersions', version);
      await get().fetchVersions();
      return version;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  updateVersion: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const existing = await getFromStore('modelVersions', id);
      if (!existing) throw new Error('版本不存在');
      const updated = { ...existing, ...data };
      await putToStore('modelVersions', updated);
      await get().fetchVersions();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  deleteVersion: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteFromStore('modelVersions', id);
      if (get().activeVersionId === id) {
        set({ activeVersionId: null });
      }
      await get().fetchVersions();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  setActiveVersion: async (id) => {
    try {
      const versions = get().versions;
      for (const v of versions) {
        const updated = { ...v, isActive: v.id === id };
        await putToStore('modelVersions', updated);
      }
      set({ activeVersionId: id });
      await get().fetchVersions();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
  getVersion: (id) => get().versions.find(v => v.id === id),
}));
