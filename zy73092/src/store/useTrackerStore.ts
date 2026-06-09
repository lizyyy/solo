import { create } from 'zustand';
import type { MaterialStatus, Specialty, ImportItem } from '@/shared/types';

interface FilterState {
  status: MaterialStatus | 'ALL';
  specialty: Specialty | 'ALL';
  search: string;
}

interface SuspendModalState {
  open: boolean;
  materialId: number | null;
  reason: string;
}

interface RerunModalState {
  open: boolean;
  materialId: number | null;
}

interface TrackerState {
  currentRole: 'ENGINEER' | 'PM';
  filter: FilterState;
  selectedMaterialId: number | null;
  suspendModal: SuspendModalState;
  rerunModal: RerunModalState;
  importPreview: ImportItem[];

  toggleRole: () => void;
  setRole: (role: 'ENGINEER' | 'PM') => void;
  setFilter: (filter: Partial<FilterState>) => void;
  setSelectedMaterialId: (id: number | null) => void;
  openSuspendModal: (materialId: number) => void;
  closeSuspendModal: () => void;
  setSuspendReason: (reason: string) => void;
  openRerunModal: (materialId: number) => void;
  closeRerunModal: () => void;
  setImportPreview: (items: ImportItem[]) => void;
  clearImportPreview: () => void;
}

const defaultFilter: FilterState = {
  status: 'ALL',
  specialty: 'ALL',
  search: '',
};

export const useTrackerStore = create<TrackerState>((set) => ({
  currentRole: 'ENGINEER',
  filter: defaultFilter,
  selectedMaterialId: null,
  suspendModal: {
    open: false,
    materialId: null,
    reason: '',
  },
  rerunModal: {
    open: false,
    materialId: null,
  },
  importPreview: [],

  toggleRole: () =>
    set((state) => ({
      currentRole: state.currentRole === 'ENGINEER' ? 'PM' : 'ENGINEER',
    })),

  setRole: (role) => set({ currentRole: role }),

  setFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),

  setSelectedMaterialId: (id) => set({ selectedMaterialId: id }),

  openSuspendModal: (materialId) =>
    set({
      suspendModal: {
        open: true,
        materialId,
        reason: '',
      },
    }),

  closeSuspendModal: () =>
    set({
      suspendModal: {
        open: false,
        materialId: null,
        reason: '',
      },
    }),

  setSuspendReason: (reason) =>
    set((state) => ({
      suspendModal: { ...state.suspendModal, reason },
    })),

  openRerunModal: (materialId) =>
    set({
      rerunModal: {
        open: true,
        materialId,
      },
    }),

  closeRerunModal: () =>
    set({
      rerunModal: {
        open: false,
        materialId: null,
      },
    }),

  setImportPreview: (items) => set({ importPreview: items }),

  clearImportPreview: () => set({ importPreview: [] }),
}));
