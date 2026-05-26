import { create } from 'zustand';

interface UIState {
  selectedRackId: string | null;
  selectedACId: string | null;
  showHeatmap: boolean;
  showLabels: boolean;
  cameraView: '3d' | 'top';
  controlPanelTab: 'ac' | 'migrate' | 'events' | 'log';
  migrateFromRackId: string | null;
  migrateToRackId: string | null;
  migrateAmount: number;
  isFullscreen: boolean;
  setSelectedRackId: (id: string | null) => void;
  setSelectedACId: (id: string | null) => void;
  toggleHeatmap: () => void;
  toggleLabels: () => void;
  setCameraView: (view: '3d' | 'top') => void;
  setControlPanelTab: (tab: 'ac' | 'migrate' | 'events' | 'log') => void;
  setMigrateFromRackId: (id: string | null) => void;
  setMigrateToRackId: (id: string | null) => void;
  setMigrateAmount: (amount: number) => void;
  toggleFullscreen: () => void;
  resetUI: () => void;
}

export const useUISTore = create<UIState>((set, get) => ({
  selectedRackId: null,
  selectedACId: null,
  showHeatmap: true,
  showLabels: true,
  cameraView: '3d',
  controlPanelTab: 'ac',
  migrateFromRackId: null,
  migrateToRackId: null,
  migrateAmount: 1,
  isFullscreen: false,

  setSelectedRackId: (id: string | null) => {
    set({ selectedRackId: id, selectedACId: null });
  },

  setSelectedACId: (id: string | null) => {
    set({ selectedACId: id, selectedRackId: null });
  },

  toggleHeatmap: () => {
    set({ showHeatmap: !get().showHeatmap });
  },

  toggleLabels: () => {
    set({ showLabels: !get().showLabels });
  },

  setCameraView: (view: '3d' | 'top') => {
    set({ cameraView: view });
  },

  setControlPanelTab: (tab: 'ac' | 'migrate' | 'events' | 'log') => {
    set({ controlPanelTab: tab });
  },

  setMigrateFromRackId: (id: string | null) => {
    set({ migrateFromRackId: id });
  },

  setMigrateToRackId: (id: string | null) => {
    set({ migrateToRackId: id });
  },

  setMigrateAmount: (amount: number) => {
    set({ migrateAmount: Math.max(0.5, Math.min(10, amount)) });
  },

  toggleFullscreen: () => {
    const newState = !get().isFullscreen;
    if (newState) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    set({ isFullscreen: newState });
  },

  resetUI: () => {
    set({
      selectedRackId: null,
      selectedACId: null,
      showHeatmap: true,
      showLabels: true,
      cameraView: '3d',
      controlPanelTab: 'ac',
      migrateFromRackId: null,
      migrateToRackId: null,
      migrateAmount: 1,
    });
  },
}));
