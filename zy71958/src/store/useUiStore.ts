import { create } from 'zustand';

type ModalType = 'import' | 'export' | 'issue' | 'routeModify' | 'confirm' | null;

interface UiState {
  currentUser: string;
  sidebarOpen: boolean;
  detailPanelOpen: boolean;
  activeModal: ModalType;
  modalData: Record<string, any>;
  statusFilter: string | null;
  searchQuery: string;
  viewMode: 'list' | '3d' | 'split';

  setCurrentUser: (user: string) => void;
  toggleSidebar: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  openModal: (type: ModalType, data?: Record<string, any>) => void;
  closeModal: () => void;
  setStatusFilter: (status: string | null) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'list' | '3d' | 'split') => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentUser: '外场队长',
  sidebarOpen: true,
  detailPanelOpen: true,
  activeModal: null,
  modalData: {},
  statusFilter: null,
  searchQuery: '',
  viewMode: 'split',

  setCurrentUser: (user) => set({ currentUser: user }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  openModal: (type, data = {}) => set({ activeModal: type, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: {} }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
