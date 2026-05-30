import { create } from 'zustand';
import { produce } from 'immer';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
}

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: 'info' | 'anomalies' | 'annotations' | 'report';
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  autoRotate: boolean;
  backgroundColor: string;
  colorScheme: 'dark' | 'light';
  hoveredCubeId: string | null;
  toasts: Toast[];
  showReportPreview: boolean;
  fileUploadDialogOpen: boolean;
  annotationDialogOpen: boolean;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: UIState['rightPanelTab']) => void;
  toggleShowGrid: () => void;
  toggleShowAxes: () => void;
  toggleShowLabels: () => void;
  toggleAutoRotate: () => void;
  setBackgroundColor: (color: string) => void;
  setColorScheme: (scheme: 'dark' | 'light') => void;
  setHoveredCubeId: (id: string | null) => void;
  setToast: (message: string, type: Toast['type'], title?: string) => void;
  showToast: (type: Toast['type'], message: string, title?: string) => void;
  removeToast: (id: string) => void;
  dismissToast: (id: string) => void;
  setShowReportPreview: (show: boolean) => void;
  setFileUploadDialogOpen: (open: boolean) => void;
  setAnnotationDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  rightPanelTab: 'info',
  showGrid: true,
  showAxes: true,
  showLabels: true,
  autoRotate: false,
  backgroundColor: '#0f1419',
  colorScheme: 'dark',
  hoveredCubeId: null,
  toasts: [],
  showReportPreview: false,
  fileUploadDialogOpen: false,
  annotationDialogOpen: false,

  toggleLeftPanel: () => {
    set(produce((state: UIState) => {
      state.leftPanelOpen = !state.leftPanelOpen;
    }));
  },

  toggleRightPanel: () => {
    set(produce((state: UIState) => {
      state.rightPanelOpen = !state.rightPanelOpen;
    }));
  },

  setRightPanelOpen: (open: boolean) => {
    set({ rightPanelOpen: open });
  },

  setRightPanelTab: (tab) => {
    set({ rightPanelTab: tab });
  },

  toggleShowGrid: () => {
    set(produce((state: UIState) => {
      state.showGrid = !state.showGrid;
    }));
  },

  toggleShowAxes: () => {
    set(produce((state: UIState) => {
      state.showAxes = !state.showAxes;
    }));
  },

  toggleShowLabels: () => {
    set(produce((state: UIState) => {
      state.showLabels = !state.showLabels;
    }));
  },

  toggleAutoRotate: () => {
    set(produce((state: UIState) => {
      state.autoRotate = !state.autoRotate;
    }));
  },

  setBackgroundColor: (color) => {
    set({ backgroundColor: color });
  },

  setColorScheme: (scheme) => {
    set({ colorScheme: scheme });
  },

  setHoveredCubeId: (id) => {
    set({ hoveredCubeId: id });
  },

  setToast: (message, type, title) => {
    get().showToast(type, message, title);
  },

  showToast: (type, message, title) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    set(produce((state: UIState) => {
      state.toasts.push({ id, type, message, title });
    }));
    
    setTimeout(() => {
      get().removeToast(id);
    }, 5000);
  },

  removeToast: (id) => {
    set(produce((state: UIState) => {
      state.toasts = state.toasts.filter(t => t.id !== id);
    }));
  },

  dismissToast: (id) => {
    get().removeToast(id);
  },

  setShowReportPreview: (show) => {
    set({ showReportPreview: show });
  },

  setFileUploadDialogOpen: (open) => {
    set({ fileUploadDialogOpen: open });
  },

  setAnnotationDialogOpen: (open) => {
    set({ annotationDialogOpen: open });
  },
}));
