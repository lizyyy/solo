import { create } from 'zustand';
import { FilterOptions } from '../types';
import { saveScrollPosition, getScrollPosition, saveFilters, getFilters, saveExpandedIds, getExpandedIds, saveChartRange, getChartRange } from '../utils/viewState';

interface ViewStateStore {
  scrollTop: number;
  filters: FilterOptions;
  expandedIds: string[];
  chartRange: { start: string; end: string };
  selectedIds: string[];
  batchProcessing: boolean;
  batchProgress: number;
  batchTotal: number;
  
  setScrollTop: (page: string, scrollTop: number) => void;
  loadScrollTop: (page: string) => number;
  setFilters: (page: string, filters: FilterOptions) => void;
  loadFilters: (page: string) => FilterOptions;
  setExpandedIds: (page: string, ids: string[]) => void;
  loadExpandedIds: (page: string) => string[];
  setChartRange: (page: string, start: string, end: string) => void;
  loadChartRange: (page: string) => { start: string; end: string };
  toggleSelectedId: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setBatchProgress: (current: number, total: number) => void;
  setBatchProcessing: (processing: boolean) => void;
}

export const useViewStore = create<ViewStateStore>((set, get) => ({
  scrollTop: 0,
  filters: {},
  expandedIds: [],
  chartRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  selectedIds: [],
  batchProcessing: false,
  batchProgress: 0,
  batchTotal: 0,

  setScrollTop: (page: string, scrollTop: number) => {
    saveScrollPosition(page, scrollTop);
    set({ scrollTop });
  },

  loadScrollTop: (page: string) => {
    const scrollTop = getScrollPosition(page);
    set({ scrollTop });
    return scrollTop;
  },

  setFilters: (page: string, filters: FilterOptions) => {
    saveFilters(page, filters);
    set({ filters });
  },

  loadFilters: (page: string) => {
    const filters = getFilters(page);
    set({ filters });
    return filters;
  },

  setExpandedIds: (page: string, ids: string[]) => {
    saveExpandedIds(page, ids);
    set({ expandedIds: ids });
  },

  loadExpandedIds: (page: string) => {
    const ids = getExpandedIds(page);
    set({ expandedIds: ids });
    return ids;
  },

  setChartRange: (page: string, start: string, end: string) => {
    saveChartRange(page, start, end);
    set({ chartRange: { start, end } });
  },

  loadChartRange: (page: string) => {
    const range = getChartRange(page);
    set({ chartRange: range });
    return range;
  },

  toggleSelectedId: (id: string) => {
    const { selectedIds } = get();
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter(i => i !== id) });
    } else {
      set({ selectedIds: [...selectedIds, id] });
    }
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: ids });
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  setBatchProgress: (current: number, total: number) => {
    set({ batchProgress: current, batchTotal: total });
  },

  setBatchProcessing: (processing: boolean) => {
    set({ batchProcessing: processing });
  },
}));
