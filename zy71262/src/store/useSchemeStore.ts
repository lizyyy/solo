import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Scheme } from '../types';

interface SchemeStore {
  schemes: Scheme[];
  
  addScheme: (name: string, description: string, pigmentIds: string[]) => void;
  updateScheme: (id: string, updates: Partial<Scheme>) => void;
  deleteScheme: (id: string) => void;
  addPigmentToScheme: (schemeId: string, pigmentId: string) => void;
  removePigmentFromScheme: (schemeId: string, pigmentId: string) => void;
  initStore: () => void;
}

const STORAGE_KEY = 'pigment-cube-schemes';

export const useSchemeStore = create<SchemeStore>((set, get) => ({
  schemes: [],

  initStore: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ schemes: parsed });
      }
    } catch {
      set({ schemes: [] });
    }
  },

  addScheme: (name, description, pigmentIds) => {
    const newScheme: Scheme = {
      id: uuidv4(),
      name,
      description,
      pigmentIds,
      createdAt: new Date().toISOString(),
    };
    
    const newSchemes = [...get().schemes, newScheme];
    set({ schemes: newSchemes });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchemes));
  },

  updateScheme: (id, updates) => {
    const updatedSchemes = get().schemes.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    set({ schemes: updatedSchemes });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSchemes));
  },

  deleteScheme: (id) => {
    const newSchemes = get().schemes.filter(s => s.id !== id);
    set({ schemes: newSchemes });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchemes));
  },

  addPigmentToScheme: (schemeId, pigmentId) => {
    const updatedSchemes = get().schemes.map(s => {
      if (s.id === schemeId && !s.pigmentIds.includes(pigmentId)) {
        return { ...s, pigmentIds: [...s.pigmentIds, pigmentId] };
      }
      return s;
    });
    set({ schemes: updatedSchemes });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSchemes));
  },

  removePigmentFromScheme: (schemeId, pigmentId) => {
    const updatedSchemes = get().schemes.map(s => {
      if (s.id === schemeId) {
        return { ...s, pigmentIds: s.pigmentIds.filter(id => id !== pigmentId) };
      }
      return s;
    });
    set({ schemes: updatedSchemes });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSchemes));
  },
}));
