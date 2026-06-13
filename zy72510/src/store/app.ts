import { create } from 'zustand';
import type { ConflictEvidence, SelfCheckReport } from '../../shared/types';

interface AppState {
  currentBatchId: string | null;
  currentSampleId: string | null;
  drawerOpen: boolean;
  conflictList: ConflictEvidence[];
  selfCheckReport: SelfCheckReport | null;
  setCurrentBatchId: (id: string | null) => void;
  setCurrentSampleId: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setConflictList: (list: ConflictEvidence[]) => void;
  setSelfCheckReport: (report: SelfCheckReport | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentBatchId: null,
  currentSampleId: null,
  drawerOpen: false,
  conflictList: [],
  selfCheckReport: null,
  setCurrentBatchId: (id) => set({ currentBatchId: id }),
  setCurrentSampleId: (id) => set({ currentSampleId: id }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setConflictList: (list) => set({ conflictList: list }),
  setSelfCheckReport: (report) => set({ selfCheckReport: report }),
}));
