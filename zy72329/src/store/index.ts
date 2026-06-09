import { create } from 'zustand';
import type { BillRecord } from '../../shared/types';

export type TabType = 'records' | 'conflicts' | 'gaps' | 'versions' | 'history' | 'import';

interface AppState {
  currentTab: TabType;
  selectedRecordId: string | null;
  selectedRecord: BillRecord | null;
  isDrawerOpen: boolean;
  compareVersions: [string | null, string | null];

  setCurrentTab: (tab: TabType) => void;
  setSelectedRecord: (record: BillRecord | null) => void;
  setSelectedRecordId: (id: string | null) => void;
  toggleDrawer: (open?: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  setCompareVersion: (index: 0 | 1, versionId: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'records',
  selectedRecordId: null,
  selectedRecord: null,
  isDrawerOpen: false,
  compareVersions: [null, null],

  setCurrentTab: (tab: TabType) => {
    set({ currentTab: tab });
  },

  setSelectedRecord: (record: BillRecord | null) => {
    set({
      selectedRecord: record,
      selectedRecordId: record?.id ?? null,
      isDrawerOpen: record !== null,
    });
  },

  setSelectedRecordId: (id: string | null) => {
    set({ selectedRecordId: id, isDrawerOpen: id !== null });
  },

  toggleDrawer: (open?: boolean) => {
    const isOpen = open ?? !get().isDrawerOpen;
    set({ isDrawerOpen: isOpen });
    if (!isOpen) {
      set({ selectedRecordId: null, selectedRecord: null });
    }
  },

  setDrawerOpen: (open: boolean) => {
    set({ isDrawerOpen: open });
    if (!open) {
      set({ selectedRecordId: null, selectedRecord: null });
    }
  },

  setCompareVersion: (index: 0 | 1, versionId: string | null) =>
    set((state) => {
      const newCompare = [...state.compareVersions] as [string | null, string | null];
      newCompare[index] = versionId;
      return { compareVersions: newCompare };
    }),
}));
