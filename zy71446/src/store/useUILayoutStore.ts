import { create } from 'zustand';

type ViewPreset = 'overview' | 'concourse' | 'platform' | 'escalators' | 'turnstiles';

interface CameraPosition {
  position: [number, number, number];
  target: [number, number, number];
}

interface UILayoutStore {
  showMenu: boolean;
  showBottleneckPanel: boolean;
  showConflictPanel: boolean;
  showReportModal: boolean;
  showViewSwitcher: boolean;

  cameraTarget: [number, number, number];
  cameraPosition: [number, number, number];
  highlightZoneId: string | null;
  selectedDeviceId: string | null;

  currentViewPreset: ViewPreset;
  currentView: ViewPreset;

  toggleMenu: () => void;
  toggleBottleneckPanel: () => void;
  toggleConflictPanel: () => void;
  toggleReportModal: () => void;
  setShowReportModal: (show: boolean) => void;

  setCameraTarget: (target: [number, number, number]) => void;
  setCameraPosition: (position: [number, number, number]) => void;
  setHighlightZoneId: (zoneId: string | null) => void;
  setSelectedDeviceId: (deviceId: string | null) => void;

  setViewPreset: (preset: ViewPreset) => void;
  focusOnZone: (zoneId: string) => void;

  getViewPresetCamera: (preset: ViewPreset) => CameraPosition;
}

const viewPresetCameras: Record<ViewPreset, CameraPosition> = {
  overview: {
    position: [30, 25, 30],
    target: [0, -3, 0],
  },
  concourse: {
    position: [15, 12, 15],
    target: [0, 0, 0],
  },
  platform: {
    position: [0, 8, 35],
    target: [0, -3, 25],
  },
  escalators: {
    position: [-15, 10, 20],
    target: [-5, -3, 15],
  },
  turnstiles: {
    position: [0, 10, 18],
    target: [0, 0, 10],
  },
};

export const useUILayoutStore = create<UILayoutStore>((set, get) => ({
  showMenu: true,
  showBottleneckPanel: true,
  showConflictPanel: true,
  showReportModal: false,
  showViewSwitcher: true,

  cameraTarget: [0, -3, 0],
  cameraPosition: [30, 25, 30],
  highlightZoneId: null,
  selectedDeviceId: null,

  currentViewPreset: 'overview',
  currentView: 'overview',

  toggleMenu: () => set((state) => ({ showMenu: !state.showMenu })),
  toggleBottleneckPanel: () => set((state) => ({ showBottleneckPanel: !state.showBottleneckPanel })),
  toggleConflictPanel: () => set((state) => ({ showConflictPanel: !state.showConflictPanel })),
  toggleReportModal: () => set((state) => ({ showReportModal: !state.showReportModal })),
  setShowReportModal: (show: boolean) => set({ showReportModal: show }),

  setCameraTarget: (target) => set({ cameraTarget: target }),
  setCameraPosition: (position) => set({ cameraPosition: position }),
  setHighlightZoneId: (zoneId) => set({ highlightZoneId: zoneId }),
  setSelectedDeviceId: (deviceId) => set({ selectedDeviceId: deviceId }),

  setViewPreset: (preset) => {
    const camera = get().getViewPresetCamera(preset);
    set({
      currentViewPreset: preset,
      currentView: preset,
      cameraPosition: camera.position,
      cameraTarget: camera.target,
    });
  },

  focusOnZone: (zoneId) => {
    const zonePositions: Record<string, [number, number, number]> = {
      concourse_main: [0, 0, 0],
      platform_line1: [0, -3, 25],
      platform_line10: [0, -6, -25],
      escalator_group_a: [-8, -1.5, 15],
      escalator_group_b: [8, -4.5, -15],
      turnstile_north: [0, 0, 10],
      turnstile_south: [0, 0, -10],
      corridor_main: [0, 0, 0],
    };

    const target = zonePositions[zoneId] || [0, 0, 0];
    const position: [number, number, number] = [target[0] + 15, target[1] + 10, target[2] + 15];

    set({
      cameraPosition: position,
      cameraTarget: target,
      highlightZoneId: zoneId,
    });
  },

  getViewPresetCamera: (preset) => {
    return viewPresetCameras[preset] || viewPresetCameras.overview;
  },
}));
