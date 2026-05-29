import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  changeLogDrawerOpen: boolean;
  newArtworkModalOpen: boolean;
  confirmDialog: {
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    confirmText: string;
    cancelText: string;
    variant: 'default' | 'danger' | 'warning';
  };
  toast: {
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  };
  loadingOverlay: boolean;
}

interface UIActions {
  toggleSidebar: () => void;
  openChangeLogDrawer: () => void;
  closeChangeLogDrawer: () => void;
  openNewArtworkModal: () => void;
  closeNewArtworkModal: () => void;
  openConfirmDialog: (options: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger' | 'warning';
  }) => void;
  closeConfirmDialog: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  hideToast: () => void;
  setLoadingOverlay: (loading: boolean) => void;
}

const initialConfirmDialog = {
  open: false,
  title: '',
  message: '',
  onConfirm: null,
  confirmText: '确认',
  cancelText: '取消',
  variant: 'default' as const,
};

const initialToast = {
  open: false,
  message: '',
  type: 'info' as const,
};

export const useUIStore = create<UIState & UIActions>((set) => ({
  sidebarOpen: true,
  changeLogDrawerOpen: false,
  newArtworkModalOpen: false,
  confirmDialog: initialConfirmDialog,
  toast: initialToast,
  loadingOverlay: false,

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  openChangeLogDrawer: () => {
    set({ changeLogDrawerOpen: true });
  },

  closeChangeLogDrawer: () => {
    set({ changeLogDrawerOpen: false });
  },

  openNewArtworkModal: () => {
    set({ newArtworkModalOpen: true });
  },

  closeNewArtworkModal: () => {
    set({ newArtworkModalOpen: false });
  },

  openConfirmDialog: ({
    title,
    message,
    onConfirm,
    confirmText = '确认',
    cancelText = '取消',
    variant = 'default',
  }) => {
    set({
      confirmDialog: {
        open: true,
        title,
        message,
        onConfirm,
        confirmText,
        cancelText,
        variant,
      },
    });
  },

  closeConfirmDialog: () => {
    set({ confirmDialog: initialConfirmDialog });
  },

  showToast: (message, type = 'success') => {
    set({
      toast: {
        open: true,
        message,
        type,
      },
    });
    setTimeout(() => {
      set({ toast: initialToast });
    }, 3000);
  },

  hideToast: () => {
    set({ toast: initialToast });
  },

  setLoadingOverlay: (loading) => {
    set({ loadingOverlay: loading });
  },
}));
