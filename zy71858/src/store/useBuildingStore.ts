import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BuildingModel } from '@/types';
import { mockBuildings } from '@/utils/mockData';

interface BuildingState {
  buildings: BuildingModel[];
  selectedBuildingId: string | null;
  setSelectedBuildingId: (id: string | null) => void;
  getBuildingById: (id: string) => BuildingModel | undefined;
}

export const useBuildingStore = create<BuildingState>()(
  persist(
    (set, get) => ({
      buildings: mockBuildings,
      selectedBuildingId: null,

      setSelectedBuildingId: (id) => {
        set({ selectedBuildingId: id });
      },

      getBuildingById: (id) => {
        return get().buildings.find((b) => b.id === id);
      },
    }),
    {
      name: 'sunshine-buildings-storage',
    }
  )
);
