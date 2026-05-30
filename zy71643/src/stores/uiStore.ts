import { create } from 'zustand';
import type { Point3D, CameraPreset } from '../types';

interface UIState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  rightPanelTab: 'config' | 'results' | 'workflow';
  showCollisionModal: boolean;
  showReportModal: boolean;
  showLogsModal: boolean;
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  currentPreset: string;
  searchPileNo: string;
  searchResults: any[];
  notification: { message: string; type: string } | null;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: 'config' | 'results' | 'workflow') => void;
  setShowCollisionModal: (show: boolean) => void;
  setShowReportModal: (show: boolean) => void;
  setShowLogsModal: (show: boolean) => void;
  setCameraPosition: (pos: Point3D, target: Point3D) => void;
  applyCameraPreset: (preset: CameraPreset) => void;
  setSearchPileNo: (value: string) => void;
  setSearchResults: (results: any[]) => void;
  showNotification: (message: string, type?: string) => void;
  hideNotification: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  rightPanelTab: 'config',
  showCollisionModal: false,
  showReportModal: false,
  showLogsModal: false,
  cameraPosition: { x: 200, y: 150, z: 150 },
  cameraTarget: { x: 150, y: 0, z: 0 },
  currentPreset: 'perspective',
  searchPileNo: '',
  searchResults: [],
  notification: null,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  setShowCollisionModal: (show) => set({ showCollisionModal: show }),

  setShowReportModal: (show) => set({ showReportModal: show }),

  setShowLogsModal: (show) => set({ showLogsModal: show }),

  setCameraPosition: (pos, target) =>
    set({ cameraPosition: pos, cameraTarget: target }),

  applyCameraPreset: (preset) =>
    set({
      cameraPosition: preset.position,
      cameraTarget: preset.target,
      currentPreset: preset.name,
    }),

  setSearchPileNo: (value) => set({ searchPileNo: value }),

  setSearchResults: (results) => set({ searchResults: results }),

  showNotification: (message, type = 'info') => {
    set({ notification: { message, type } });
    setTimeout(() => set({ notification: null }), 3000);
  },

  hideNotification: () => set({ notification: null }),
}));
