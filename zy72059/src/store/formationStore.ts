import { create } from 'zustand';
import type { Drone, Obstacle, Position3D, StatusType } from '@/types';

interface FormationState {
  drones: Drone[];
  obstacles: Obstacle[];
  selectedDroneId: string | null;
  focusedDroneId: string | null;
  statusFilter: StatusType | 'ALL';
  setDrones: (drones: Drone[]) => void;
  setObstacles: (obstacles: Obstacle[]) => void;
  addDrone: (drone: Drone) => void;
  updateDrone: (id: string, updates: Partial<Drone>) => void;
  removeDrone: (id: string) => void;
  selectDrone: (id: string | null) => void;
  focusDrone: (id: string | null) => void;
  setStatusFilter: (status: StatusType | 'ALL') => void;
  updateDroneNote: (id: string, note: string) => void;
  updateDroneStatus: (id: string, status: StatusType) => void;
  getSelectedDrone: () => Drone | undefined;
  getFilteredDrones: () => Drone[];
  clearAll: () => void;
}

export const useFormationStore = create<FormationState>((set, get) => ({
  drones: [],
  obstacles: [],
  selectedDroneId: null,
  focusedDroneId: null,
  statusFilter: 'ALL',

  setDrones: (drones) => set({ drones }),
  setObstacles: (obstacles) => set({ obstacles }),

  addDrone: (drone) =>
    set((state) => ({
      drones: [...state.drones, drone],
    })),

  updateDrone: (id, updates) =>
    set((state) => ({
      drones: state.drones.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      ),
    })),

  removeDrone: (id) =>
    set((state) => ({
      drones: state.drones.filter((d) => d.id !== id),
      selectedDroneId: state.selectedDroneId === id ? null : state.selectedDroneId,
    })),

  selectDrone: (id) => set({ selectedDroneId: id }),
  focusDrone: (id) => set({ focusedDroneId: id }),
  setStatusFilter: (status) => set({ statusFilter: status }),

  updateDroneNote: (id, note) =>
    set((state) => ({
      drones: state.drones.map((d) =>
        d.id === id
          ? { ...d, currentNote: note, updatedAt: new Date().toISOString() }
          : d
      ),
    })),

  updateDroneStatus: (id, status) =>
    set((state) => ({
      drones: state.drones.map((d) =>
        d.id === id
          ? { ...d, status, updatedAt: new Date().toISOString() }
          : d
      ),
    })),

  getSelectedDrone: () => {
    const { drones, selectedDroneId } = get();
    return drones.find((d) => d.id === selectedDroneId);
  },

  getFilteredDrones: () => {
    const { drones, statusFilter } = get();
    if (statusFilter === 'ALL') return drones;
    return drones.filter((d) => d.status === statusFilter);
  },

  clearAll: () =>
    set({
      drones: [],
      obstacles: [],
      selectedDroneId: null,
      focusedDroneId: null,
    }),
}));
