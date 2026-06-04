import { create } from 'zustand';

export type TabType = 'records' | 'conflicts' | 'gaps' | 'versions' | 'history' | 'import';

interface AppState {
  currentTab: TabType;
  selectedRecordId: string | null;
  isDrawerOpen: boolean;
  setCurrentTab: (tab: TabType) => void;
  setSelectedRecord: (id: string | null) => void;
  toggleDrawer: (open?: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'records',
  selectedRecordId: null,
  isDrawerOpen: false,

  setCurrentTab: (tab: TabType) => {
    set({ currentTab: tab });
  },

  setSelectedRecord: (id: string | null) => {
    set({ selectedRecordId: id, isDrawerOpen: id !== null });
  },

  toggleDrawer: (open?: boolean) => {
    const isOpen = open ?? !get().isDrawerOpen;
    set({ isDrawerOpen: isOpen });
    if (!isOpen) {
      set({ selectedRecordId: null });
    }
  },
}));
