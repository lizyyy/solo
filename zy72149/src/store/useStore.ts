import { create } from 'zustand';
import type { AudioMaterial, FilterState, ToastMessage, ExceptionType } from '../types';
import { loadMaterials, saveMaterials, loadFilterState, saveFilterState, loadPreferences, savePreferences } from '../utils/storage';
import { detectAllExceptions } from '../utils/detection';

interface AppState {
  materials: AudioMaterial[];
  filter: FilterState;
  preferences: { exceptionPanelOpen: boolean };
  toasts: ToastMessage[];
  editingMaterial: AudioMaterial | null;
  isEditModalOpen: boolean;

  initStore: () => void;
  setMaterials: (materials: AudioMaterial[]) => void;
  updateMaterial: (id: string, updates: Partial<AudioMaterial>) => void;
  resolveException: (materialId: string, exceptionType: ExceptionType) => void;
  addMaterial: (material: Omit<AudioMaterial, 'id' | 'processedAt'>) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  toggleExceptionPanel: () => void;
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
  openEditModal: (material: AudioMaterial) => void;
  closeEditModal: () => void;
  runExceptionDetection: () => void;
  getFilteredMaterials: () => AudioMaterial[];
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useStore = create<AppState>((set, get) => ({
  materials: [],
  filter: {
    emotionTag: 'all',
    status: 'all',
    source: 'all',
    exceptionType: 'all',
    dateRange: null,
    searchKeyword: '',
  },
  preferences: { exceptionPanelOpen: true },
  toasts: [],
  editingMaterial: null,
  isEditModalOpen: false,

  initStore: () => {
    const materials = loadMaterials();
    const filter = loadFilterState();
    const preferences = loadPreferences();
    const detectedMaterials = detectAllExceptions(materials);
    
    if (JSON.stringify(materials) !== JSON.stringify(detectedMaterials)) {
      saveMaterials(detectedMaterials);
    }
    
    set({ materials: detectedMaterials, filter, preferences });
  },

  setMaterials: (materials) => {
    const detected = detectAllExceptions(materials);
    saveMaterials(detected);
    set({ materials: detected });
  },

  updateMaterial: (id, updates) => {
    set((state) => {
      const materials = state.materials.map((m) =>
        m.id === id
          ? {
              ...m,
              ...updates,
              processedAt: new Date().toISOString(),
              status: updates.emotionTag && m.status === 'pending' ? 'reviewed' : m.status,
            }
          : m
      );
      const detected = detectAllExceptions(materials);
      saveMaterials(detected);
      return { materials: detected };
    });
  },

  resolveException: (materialId, exceptionType) => {
    set((state) => {
      const materials = state.materials.map((m) =>
        m.id === materialId
          ? {
              ...m,
              exceptions: m.exceptions.map((e) =>
                e.type === exceptionType ? { ...e, resolved: true } : e
              ),
              processedAt: new Date().toISOString(),
            }
          : m
      );
      const detected = detectAllExceptions(materials);
      saveMaterials(detected);
      return { materials: detected };
    });
  },

  addMaterial: (material) => {
    set((state) => {
      const newMaterial: AudioMaterial = {
        ...material,
        id: generateId(),
        processedAt: new Date().toISOString(),
      };
      const materials = [...state.materials, newMaterial];
      const detected = detectAllExceptions(materials);
      saveMaterials(detected);
      return { materials: detected };
    });
  },

  setFilter: (updates) => {
    set((state) => {
      const filter = { ...state.filter, ...updates };
      saveFilterState(filter);
      return { filter };
    });
  },

  resetFilter: () => {
    const defaultFilter: FilterState = {
      emotionTag: 'all',
      status: 'all',
      source: 'all',
      exceptionType: 'all',
      dateRange: null,
      searchKeyword: '',
    };
    saveFilterState(defaultFilter);
    set({ filter: defaultFilter });
  },

  toggleExceptionPanel: () => {
    set((state) => {
      const preferences = { exceptionPanelOpen: !state.preferences.exceptionPanelOpen };
      savePreferences(preferences);
      return { preferences };
    });
  },

  addToast: (type, message) => {
    const id = generateId();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 3000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  openEditModal: (material) => {
    set({ editingMaterial: material, isEditModalOpen: true });
  },

  closeEditModal: () => {
    set({ editingMaterial: null, isEditModalOpen: false });
  },

  runExceptionDetection: () => {
    set((state) => {
      const detected = detectAllExceptions(state.materials);
      saveMaterials(detected);
      return { materials: detected };
    });
  },

  getFilteredMaterials: () => {
    const { materials, filter } = get();
    return materials.filter((m) => {
      if (filter.emotionTag !== 'all' && m.emotionTag !== filter.emotionTag) return false;
      if (filter.status !== 'all' && m.status !== filter.status) return false;
      if (filter.source !== 'all' && m.source !== filter.source) return false;
      if (filter.exceptionType !== 'all' && !m.exceptions.some((e) => e.type === filter.exceptionType && !e.resolved)) return false;
      
      if (filter.searchKeyword) {
        const keyword = filter.searchKeyword.toLowerCase();
        const inFileName = m.fileName.toLowerCase().includes(keyword);
        const inTrackName = m.trackName.toLowerCase().includes(keyword);
        const inRemark = m.remark.toLowerCase().includes(keyword);
        const inSource = m.originalSource.toLowerCase().includes(keyword);
        if (!inFileName && !inTrackName && !inRemark && !inSource) return false;
      }

      if (filter.dateRange) {
        const processedDate = new Date(m.processedAt);
        const start = new Date(filter.dateRange.start);
        const end = new Date(filter.dateRange.end);
        end.setHours(23, 59, 59, 999);
        if (processedDate < start || processedDate > end) return false;
      }

      return true;
    });
  },
}));
