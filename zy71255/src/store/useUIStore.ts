import { create } from 'zustand';

export type ViewPreset = 'overview' | 'top' | 'side' | 'focus';
export type CameraPosition = [number, number, number];

interface UIState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  currentViewPreset: ViewPreset;
  cameraPosition: CameraPosition;
  cameraTarget: CameraPosition;
  showVersionCompareModal: boolean;
  showIssueList: boolean;
  fps: number;
  isResizingLeft: boolean;
  isResizingRight: boolean;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setViewPreset: (preset: ViewPreset) => void;
  setCameraPosition: (position: CameraPosition) => void;
  setCameraTarget: (target: CameraPosition) => void;
  setShowVersionCompareModal: (show: boolean) => void;
  setShowIssueList: (show: boolean) => void;
  setFps: (fps: number) => void;
  setIsResizingLeft: (resizing: boolean) => void;
  setIsResizingRight: (resizing: boolean) => void;
}

const initialState = {
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelWidth: 320,
  rightPanelWidth: 380,
  currentViewPreset: 'overview' as ViewPreset,
  cameraPosition: [0, 15, 25] as CameraPosition,
  cameraTarget: [0, 0, 0] as CameraPosition,
  showVersionCompareModal: false,
  showIssueList: false,
  fps: 60,
  isResizingLeft: false,
  isResizingRight: false,
};

export const useUIStore = create<UIState>((set) => ({
  ...initialState,

  toggleLeftPanel: () => {
    set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed }));
  },

  toggleRightPanel: () => {
    set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed }));
  },

  setLeftPanelWidth: (width) => {
    set({ leftPanelWidth: Math.max(240, Math.min(500, width)) });
  },

  setRightPanelWidth: (width) => {
    set({ rightPanelWidth: Math.max(280, Math.min(600, width)) });
  },

  setViewPreset: (preset) => {
    const presets: Record<ViewPreset, { position: CameraPosition; target: CameraPosition }> = {
      overview: { position: [0, 15, 25], target: [0, 0, 0] },
      top: { position: [0, 35, 0.1], target: [0, 0, 0] },
      side: { position: [25, 8, 0], target: [0, 0, 0] },
      focus: { position: [0, 8, 12], target: [0, 0, 0] },
    };
    const { position, target } = presets[preset];
    set({
      currentViewPreset: preset,
      cameraPosition: position,
      cameraTarget: target,
    });
  },

  setCameraPosition: (position) => {
    set({ cameraPosition: position });
  },

  setCameraTarget: (target) => {
    set({ cameraTarget: target });
  },

  setShowVersionCompareModal: (show) => {
    set({ showVersionCompareModal: show });
  },

  setShowIssueList: (show) => {
    set({ showIssueList: show });
  },

  setFps: (fps) => {
    set({ fps });
  },

  setIsResizingLeft: (resizing) => {
    set({ isResizingLeft: resizing });
  },

  setIsResizingRight: (resizing) => {
    set({ isResizingRight: resizing });
  },
}));
