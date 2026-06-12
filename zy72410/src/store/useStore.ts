import { create } from 'zustand';
import type {
  Material, Track, Conflict, TunerMessage, RehearsalChange,
  ImportPreviewResult, SelfCheckResult, ReportSummary
} from '../types';

interface AppState {
  currentUser: string;
  setCurrentUser: (user: string) => void;

  materials: Array<Material & { tracks: Track[] }>;
  setMaterials: (materials: Array<Material & { tracks: Track[] }>) => void;
  addMaterial: (material: Material & { tracks: Track[] }) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;

  importPreview: ImportPreviewResult | null;
  setImportPreview: (preview: ImportPreviewResult | null) => void;

  pendingConflicts: Conflict[];
  setPendingConflicts: (conflicts: Conflict[]) => void;

  selfCheckResults: SelfCheckResult[];
  setSelfCheckResults: (results: SelfCheckResult[] | ((prev: SelfCheckResult[]) => SelfCheckResult[])) => void;

  reportSummary: ReportSummary | null;
  setReportSummary: (summary: ReportSummary | null) => void;

  loading: Record<string, boolean>;
  setLoading: (key: string, value: boolean) => void;

  notification: { type: 'success' | 'error' | 'warning'; message: string } | null;
  showNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
  clearNotification: () => void;

  activeTab: string;
  setActiveTab: (tab: string) => void;

  selectedMaterialId: string | null;
  setSelectedMaterialId: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: '版权运营',
  setCurrentUser: (user) => set({ currentUser: user }),

  materials: [],
  setMaterials: (materials) => set({ materials }),
  addMaterial: (material) => set((state) => ({
    materials: [material, ...state.materials]
  })),
  updateMaterial: (id, updates) => set((state) => ({
    materials: state.materials.map(m =>
      m.id === id ? { ...m, ...updates } : m
    )
  })),

  importPreview: null,
  setImportPreview: (preview) => set({ importPreview: preview }),

  pendingConflicts: [],
  setPendingConflicts: (conflicts) => set({ pendingConflicts: conflicts }),

  selfCheckResults: [],
  setSelfCheckResults: (results) => set((state) => ({ 
    selfCheckResults: typeof results === 'function' ? results(state.selfCheckResults) : results 
  })),

  reportSummary: null,
  setReportSummary: (summary) => set({ reportSummary: summary }),

  loading: {},
  setLoading: (key, value) => set((state) => ({
    loading: { ...state.loading, [key]: value }
  })),

  notification: null,
  showNotification: (type, message) => set({ notification: { type, message } }),
  clearNotification: () => set({ notification: null }),

  activeTab: 'import',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedMaterialId: null,
  setSelectedMaterialId: (id) => set({ selectedMaterialId: id }),
}));
