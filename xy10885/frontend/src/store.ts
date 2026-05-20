import { create } from 'zustand';

interface AppState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  filters: {
    department_id?: string;
    date?: string;
    status?: string;
  };
  setFilters: (filters: any) => void;
  notification: {
    type: 'success' | 'error' | 'warning' | null;
    message: string;
  };
  showNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
  clearNotification: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'slots',
  setActiveTab: (tab) => set({ activeTab: tab }),
  filters: {},
  setFilters: (filters) => set({ filters }),
  notification: { type: null, message: '' },
  showNotification: (type, message) => set({ notification: { type, message } }),
  clearNotification: () => set({ notification: { type: null, message: '' } })
}));
