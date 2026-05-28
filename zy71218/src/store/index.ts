import { create } from 'zustand';
import type { User } from '../../shared/types';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface Filters {
  [key: string]: any;
}

interface AppState {
  user: User | null;
  loading: boolean;
  notifications: Notification[];
  filters: Filters;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  showNotification: (type: Notification['type'], message: string) => void;
  clearNotification: (id: string) => void;
  setFilters: (key: string, value: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  loading: false,
  notifications: [],
  filters: {},

  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ loading }),

  showNotification: (type, message) => {
    const id = Date.now().toString();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 3000);
  },

  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  setFilters: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
}));
