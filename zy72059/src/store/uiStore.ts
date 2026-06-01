import { create } from 'zustand';
import type { Position3D } from '@/types';

interface UIState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  showImportModal: boolean;
  showSaveModal: boolean;
  showSchemeList: boolean;
  showExportOptions: boolean;
  cameraPosition: Position3D;
  cameraTarget: Position3D;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setShowImportModal: (show: boolean) => void;
  setShowSaveModal: (show: boolean) => void;
  setShowSchemeList: (show: boolean) => void;
  setShowExportOptions: (show: boolean) => void;
  setCameraPosition: (pos: Position3D) => void;
  setCameraTarget: (target: Position3D) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  showImportModal: false,
  showSaveModal: false,
  showSchemeList: false,
  showExportOptions: false,
  cameraPosition: { x: 30, y: 30, z: 30 },
  cameraTarget: { x: 0, y: 0, z: 0 },

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () =>
    set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setShowSaveModal: (show) => set({ showSaveModal: show }),
  setShowSchemeList: (show) => set({ showSchemeList: show }),
  setShowExportOptions: (show) => set({ showExportOptions: show }),
  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
}));
