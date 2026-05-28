import { create } from 'zustand';
import { DataSource } from '../game/types';

interface UIState {
  activeDataPanel: DataSource | null;
  expandedPanels: Record<DataSource, boolean>;
  showRules: boolean;
  showExportModal: boolean;
  notifications: { id: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }[];
  setActiveDataPanel: (panel: DataSource | null) => void;
  togglePanel: (source: DataSource) => void;
  setShowRules: (show: boolean) => void;
  setShowExportModal: (show: boolean) => void;
  addNotification: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeDataPanel: null,
  expandedPanels: {
    [DataSource.HALL]: true,
    [DataSource.ART]: true,
    [DataSource.DOOR]: true,
    [DataSource.LIGHT]: true,
    [DataSource.ROUTE]: true,
    [DataSource.REPORT]: true,
  },
  showRules: false,
  showExportModal: false,
  notifications: [],

  setActiveDataPanel: (panel: DataSource | null) => {
    set({ activeDataPanel: panel });
  },

  togglePanel: (source: DataSource) => {
    set(state => ({
      expandedPanels: {
        ...state.expandedPanels,
        [source]: !state.expandedPanels[source],
      },
    }));
  },

  setShowRules: (show: boolean) => {
    set({ showRules: show });
  },

  setShowExportModal: (show: boolean) => {
    set({ showExportModal: show });
  },

  addNotification: (message: string, type: 'info' | 'warning' | 'error' | 'success') => {
    const id = Date.now().toString();
    set(state => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    
    setTimeout(() => {
      get().removeNotification(id);
    }, 3000);
  },

  removeNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }));
  },
}));
