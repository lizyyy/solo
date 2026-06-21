import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  SandboxState,
  Filters,
  CameraState,
  UserMarker,
  Building,
} from '../data/types';
import { mockBuildings } from '../data/mockBuildings';
import {
  loadPersistedState,
  savePersistedState,
  clearPersistedState,
  defaultFilters,
  defaultCameraState,
  defaultUserMarkers,
} from '../utils/storage';

const persisted = loadPersistedState();

const initialState: Omit<
  SandboxState,
  | 'setFilters'
  | 'setCurrentHour'
  | 'setSelectedBuilding'
  | 'toggleBuildingAnomaly'
  | 'confirmBuilding'
  | 'saveCameraState'
  | 'resetAll'
> = {
  filters: persisted?.filters || defaultFilters,
  currentHour: persisted?.currentHour ?? 12,
  selectedBuildingId: null,
  buildings: mockBuildings,
  userMarkers: persisted?.userMarkers || defaultUserMarkers,
  cameraState: persisted?.cameraState || defaultCameraState,
};

export const useSandboxStore = create<SandboxState>((set, get) => ({
  ...initialState,

  setFilters: (newFilters: Partial<Filters>) => {
    set(state => {
      const updated = {
        ...state,
        filters: { ...state.filters, ...newFilters },
      };
      savePersistedState({
        userMarkers: updated.userMarkers,
        cameraState: updated.cameraState,
        filters: updated.filters,
        currentHour: updated.currentHour,
      });
      return updated;
    });
  },

  setCurrentHour: (hour: number | ((prev: number) => number)) => {
    set(state => {
      const newHour = typeof hour === 'function' ? hour(state.currentHour) : hour;
      const updated = { ...state, currentHour: Math.max(0, Math.min(24, newHour)) };
      savePersistedState({
        userMarkers: updated.userMarkers,
        cameraState: updated.cameraState,
        filters: updated.filters,
        currentHour: updated.currentHour,
      });
      return updated;
    });
  },

  setSelectedBuilding: (id: string | null) => {
    set({ selectedBuildingId: id });
  },

  toggleBuildingAnomaly: (id: string, note?: string) => {
    set(state => {
      const existing = state.userMarkers[id];
      const updatedMarkers: Record<string, UserMarker> = {
        ...state.userMarkers,
        [id]: {
          isAnomaly: !existing?.isAnomaly,
          anomalyNote: note || existing?.anomalyNote || '',
          confirmed: existing?.confirmed || false,
        },
      };
      const updated = { ...state, userMarkers: updatedMarkers };
      savePersistedState({
        userMarkers: updated.userMarkers,
        cameraState: updated.cameraState,
        filters: updated.filters,
        currentHour: updated.currentHour,
      });
      return updated;
    });
  },

  confirmBuilding: (id: string) => {
    set(state => {
      const existing = state.userMarkers[id];
      const updatedMarkers: Record<string, UserMarker> = {
        ...state.userMarkers,
        [id]: {
          isAnomaly: existing?.isAnomaly || false,
          anomalyNote: existing?.anomalyNote || '',
          confirmed: true,
        },
      };
      const updated = { ...state, userMarkers: updatedMarkers };
      savePersistedState({
        userMarkers: updated.userMarkers,
        cameraState: updated.cameraState,
        filters: updated.filters,
        currentHour: updated.currentHour,
      });
      return updated;
    });
  },

  saveCameraState: (pos: [number, number, number], target: [number, number, number]) => {
    set(state => {
      const updated: SandboxState = {
        ...state,
        cameraState: { position: pos, target },
      };
      savePersistedState({
        userMarkers: updated.userMarkers,
        cameraState: updated.cameraState,
        filters: updated.filters,
        currentHour: updated.currentHour,
      });
      return updated;
    });
  },

  resetAll: () => {
    clearPersistedState();
    set({
      filters: defaultFilters,
      currentHour: 12,
      selectedBuildingId: null,
      userMarkers: defaultUserMarkers,
      cameraState: defaultCameraState,
    });
  },
}));

export function useFilters(): Filters {
  return useSandboxStore(useShallow(state => state.filters));
}

export function useCurrentHour(): number {
  return useSandboxStore(state => state.currentHour);
}

export function useSelectedBuilding(): Building | null {
  return useSandboxStore(state => {
    if (!state.selectedBuildingId) return null;
    return state.buildings.find(b => b.id === state.selectedBuildingId) || null;
  });
}

export function useBuildings(): Building[] {
  return useSandboxStore(useShallow(state => state.buildings));
}

export function useFilteredBuildings(): Building[] {
  return useSandboxStore(useShallow(state => {
    const { buildings, filters } = state;
    return buildings.filter(b => {
      if (filters.district.length > 0 && !filters.district.includes(b.district)) {
        return false;
      }
      if (b.floors < filters.floors[0] || b.floors > filters.floors[1]) {
        return false;
      }
      if (b.sunlightHours !== null) {
        if (
          b.sunlightHours < filters.sunlightHours[0] ||
          b.sunlightHours > filters.sunlightHours[1]
        ) {
          return false;
        }
      }
      if (filters.anomalyType.length > 0) {
        const hasAnomaly = filters.anomalyType.some(t =>
          b.anomalies.includes(t as never)
        );
        if (!hasAnomaly) return false;
      }
      return true;
    });
  }));
}

export function useUserMarker(buildingId: string | undefined): UserMarker | undefined {
  return useSandboxStore(state =>
    buildingId ? state.userMarkers[buildingId] : undefined
  );
}

export function useCameraState(): CameraState {
  return useSandboxStore(useShallow(state => state.cameraState));
}
