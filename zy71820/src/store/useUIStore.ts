import { create } from 'zustand';
import type { ErrorMessage } from '../types/data';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ModalContent {
  title: string;
  error?: ErrorMessage;
  children?: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface UIStore {
  toasts: Toast[];
  showModal: boolean;
  modalContent: ModalContent | null;
  activeTab: string;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  openModal: (content: ModalContent) => void;
  closeModal: () => void;
  setActiveTab: (tab: string) => void;
  showError: (error: ErrorMessage) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  toasts: [],
  showModal: false,
  modalContent: null,
  activeTab: 'game',

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    if (toast.duration !== 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, toast.duration || 4000);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),

  openModal: (content) =>
    set({
      showModal: true,
      modalContent: content,
    }),

  closeModal: () =>
    set({
      showModal: false,
      modalContent: null,
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  showError: (error) => {
    get().openModal({
      title: '出了点小问题',
      error,
      confirmText: '我知道了',
    });
  },

  showSuccess: (message) => {
    get().addToast({
      type: 'success',
      message,
      duration: 3000,
    });
  },

  showWarning: (message) => {
    get().addToast({
      type: 'warning',
      message,
      duration: 5000,
    });
  },
}));
