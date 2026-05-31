import { create } from 'zustand';
import type { ToastMessage } from '@/types';

interface AppState {
  toasts: ToastMessage[];
  knowledgeChanged: boolean;
  loading: boolean;

  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  setKnowledgeChanged: (changed: boolean) => void;

  setLoading: (loading: boolean) => void;
}

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const useStore = create<AppState>((set) => ({
  toasts: [],
  knowledgeChanged: false,
  loading: false,

  addToast: (toast) => {
    const id = generateId();
    const newToast = { ...toast, id };
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (toast.duration !== 0) {
      const duration = toast.duration || 3000;
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },

  setKnowledgeChanged: (changed) => {
    set({ knowledgeChanged: changed });
  },

  setLoading: (loading) => {
    set({ loading });
  },
}));

export default useStore;
