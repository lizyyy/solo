import { create } from 'zustand';
import type { Notification } from '@/types/simulation';
import { nanoid } from 'nanoid';

interface UIState {
  sidebarOpen: boolean;
  showExplanation: boolean;
  showAnomalyPanel: boolean;
  showSupplementModal: boolean;
  showImportModal: boolean;
  showVersionCompare: boolean;
  supplementPointId: string | null;
  notifications: Notification[];
  toggleSidebar: () => void;
  setShowExplanation: (show: boolean) => void;
  setShowAnomalyPanel: (show: boolean) => void;
  setShowSupplementModal: (show: boolean, pointId?: string | null) => void;
  setShowImportModal: (show: boolean) => void;
  setShowVersionCompare: (show: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  showExplanation: true,
  showAnomalyPanel: false,
  showSupplementModal: false,
  showImportModal: false,
  showVersionCompare: false,
  supplementPointId: null,
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setShowExplanation: (show) => set({ showExplanation: show }),
  setShowAnomalyPanel: (show) => set({ showAnomalyPanel: show }),
  setShowSupplementModal: (show, pointId) => set({ showSupplementModal: show, supplementPointId: pointId || null }),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setShowVersionCompare: (show) => set({ showVersionCompare: show }),

  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { ...notification, id: nanoid() }],
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),

  clearNotifications: () => set({ notifications: [] }),
}));
