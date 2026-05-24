
import { create } from 'zustand';
import { ElementType, FilterState } from '../types/model';

interface FilterStore extends FilterState {
  setTypes: (types: ElementType[]) => void;
  toggleType: (type: ElementType) => void;
  setElevationRange: (range: [number, number]) => void;
  setVersions: (versions: number[]) => void;
  setShowOnlyColliding: (show: boolean) => void;
  setSearchText: (text: string) => void;
  resetFilters: () => void;
}

const defaultState: FilterState = {
  types: ['cable_tray', 'duct', 'fire_pipe'],
  elevationRange: [2.0, 4.5],
  versions: [1, 2],
  showOnlyColliding: false,
  searchText: ''
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...defaultState,

  setTypes: (types) => set({ types }),

  toggleType: (type) => set((state) => ({
    types: state.types.includes(type)
      ? state.types.filter(t => t !== type)
      : [...state.types, type]
  })),

  setElevationRange: (range) => set({ elevationRange: range }),

  setVersions: (versions) => set({ versions }),

  setShowOnlyColliding: (show) => set({ showOnlyColliding: show }),

  setSearchText: (text) => set({ searchText: text }),

  resetFilters: () => set(defaultState)
}));
