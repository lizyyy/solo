import { create } from 'zustand';
import type { Enterprise } from '@/types';

interface FilterState {
  selectedEnterprises: string[];
  selectedPeriod: string | null;
  showOnlyWithGap: boolean;
  gapThreshold: number;
  showIssues: boolean;
  showFlows: boolean;
  timePosition: number;
  isPlaying: boolean;
  searchQuery: string;

  toggleEnterprise: (id: string) => void;
  selectAllEnterprises: (enterprises: Enterprise[]) => void;
  clearEnterprises: () => void;
  setSelectedPeriod: (id: string | null) => void;
  setShowOnlyWithGap: (value: boolean) => void;
  setGapThreshold: (value: number) => void;
  setShowIssues: (value: boolean) => void;
  setShowFlows: (value: boolean) => void;
  setTimePosition: (value: number | ((prev: number) => number)) => void;
  togglePlaying: () => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

const initialState = {
  selectedEnterprises: [],
  selectedPeriod: null,
  showOnlyWithGap: false,
  gapThreshold: 0,
  showIssues: true,
  showFlows: true,
  timePosition: 0,
  isPlaying: false,
  searchQuery: '',
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,

  toggleEnterprise: (id) => {
    set((state) => ({
      selectedEnterprises: state.selectedEnterprises.includes(id)
        ? state.selectedEnterprises.filter((e) => e !== id)
        : [...state.selectedEnterprises, id],
    }));
  },

  selectAllEnterprises: (enterprises) => {
    set({
      selectedEnterprises: enterprises.map((e) => e.id),
    });
  },

  clearEnterprises: () => {
    set({ selectedEnterprises: [] });
  },

  setSelectedPeriod: (id) => {
    set({ selectedPeriod: id });
  },

  setShowOnlyWithGap: (value) => {
    set({ showOnlyWithGap: value });
  },

  setGapThreshold: (value) => {
    set({ gapThreshold: value });
  },

  setShowIssues: (value) => {
    set({ showIssues: value });
  },

  setShowFlows: (value) => {
    set({ showFlows: value });
  },

  setTimePosition: (value) => {
    set((state) => ({
      timePosition: typeof value === 'function' ? value(state.timePosition) : value,
    }));
  },

  togglePlaying: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  resetFilters: () => {
    set(initialState);
  },
}));
