import { create } from 'zustand';
import type { FilterState, MatchStatus } from '@/shared/types';

interface UiState {
  selectedComponentId: string | null;
  selectedItemId: string | null;
  filters: FilterState;
  timelineDate: string | null;
  viewMode: '3d' | 'list' | 'split';
  issuePanelOpen: boolean;
  sourcePanelOpen: boolean;

  selectComponent: (id: string | null) => void;
  selectItemId: (id: string | null) => void;
  setFilters: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;
  setTimelineDate: (d: string | null) => void;
  setViewMode: (m: UiState['viewMode']) => void;
  setIssuePanelOpen: (v: boolean) => void;
  setSourcePanelOpen: (v: boolean) => void;
  toggleStatusFilter: (status: MatchStatus) => void;
  toggleComponentFilter: (componentId: string) => void;
}

export const defaultFilters: FilterState = {
  componentIds: [],
  visaNos: [],
  materialBatchNos: [],
  statuses: [],
  dateRange: null,
};

export const useUiStore = create<UiState>((set, get) => ({
  selectedComponentId: null,
  selectedItemId: null,
  filters: { ...defaultFilters },
  timelineDate: null,
  viewMode: 'split',
  issuePanelOpen: true,
  sourcePanelOpen: true,

  selectComponent: (id) => {
    set((s) => {
      const current = get();
      if (current.selectedComponentId === id) return s;
      if (id) {
        const f = current.filters;
        const exists = f.componentIds.includes(id);
        const componentIds = exists
          ? f.componentIds.filter((x) => x !== id)
          : [...f.componentIds, id];
        return {
          selectedComponentId: id,
          filters: { ...f, componentIds: exists ? [] : [id] },
        };
      }
      return { selectedComponentId: null };
    });
  },

  selectItemId: (id) => set({ selectedItemId: id }),

  setFilters: (partial) =>
    set((s) => ({
      filters: { ...s.filters, ...partial },
    })),

  resetFilters: () => set({ filters: { ...defaultFilters }, timelineDate: null }),

  setTimelineDate: (d) => set({ timelineDate: d }),

  setViewMode: (m) => set({ viewMode: m }),

  setIssuePanelOpen: (v) => set({ issuePanelOpen: v }),
  setSourcePanelOpen: (v) => set({ sourcePanelOpen: v }),

  toggleStatusFilter: (status) =>
    set((s) => {
      const cur = s.filters.statuses;
      const next = cur.includes(status) ? cur.filter((x) => x !== status) : [...cur, status];
      return { filters: { ...s.filters, statuses: next } };
    }),

  toggleComponentFilter: (componentId) =>
    set((s) => {
      const cur = s.filters.componentIds;
      const next = cur.includes(componentId)
        ? cur.filter((x) => x !== componentId)
        : [...cur, componentId];
      return {
        filters: { ...s.filters, componentIds: next },
        selectedComponentId: next.length ? componentId : null,
      };
    }),
}));
