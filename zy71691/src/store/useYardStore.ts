import { create } from 'zustand';
import type {
  ContainerSlot,
  Crane,
  Truck,
  Conflict,
  TimelineEvent,
  SavedScenario,
  FilterState,
  Position,
  YardStatistics,
} from '@/types';
import {
  mockContainerSlots,
  mockCranes,
  mockTrucks,
  mockConflicts,
  mockTimelineEvents,
  mockSavedScenarios,
} from '@/data/mockData';

interface YardState {
  containerSlots: ContainerSlot[];
  cranes: Crane[];
  trucks: Truck[];
  conflicts: Conflict[];
  timelineEvents: TimelineEvent[];
  savedScenarios: SavedScenario[];
  selectedObjectId: string | null;
  selectedObjectType: 'slot' | 'crane' | 'truck' | 'conflict' | null;
  filters: FilterState;
  currentTime: Date;
  isPlaying: boolean;
  playbackSpeed: number;
  cameraPosition: Position;
  cameraTarget: Position;
  sidePanelOpen: boolean;
  sidePanelTab: 'details' | 'conflicts' | 'filters';

  setSelectedObject: (id: string | null, type: 'slot' | 'crane' | 'truck' | 'conflict' | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setCurrentTime: (time: Date) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setCameraPosition: (position: Position) => void;
  setCameraTarget: (target: Position) => void;
  toggleSidePanel: () => void;
  setSidePanelTab: (tab: 'details' | 'conflicts' | 'filters') => void;
  resolveConflict: (conflictId: string) => void;
  saveScenario: (name: string, description: string, screenshot?: string) => void;
  loadScenario: (scenarioId: string) => void;
  deleteScenario: (scenarioId: string) => void;
  getStatistics: () => YardStatistics;
  getFilteredSlots: () => ContainerSlot[];
  getFilteredCranes: () => Crane[];
  getFilteredTrucks: () => Truck[];
  getFilteredConflicts: () => Conflict[];
  focusOnConflict: (conflictId: string) => void;
}

const defaultFilters: FilterState = {
  containerTypes: [],
  slotStatuses: [],
  craneStatuses: [],
  truckStatuses: [],
  timeRange: null,
  showConflictsOnly: false,
  conflictTypes: [],
};

export const useYardStore = create<YardState>((set, get) => ({
  containerSlots: mockContainerSlots,
  cranes: mockCranes,
  trucks: mockTrucks,
  conflicts: mockConflicts,
  timelineEvents: mockTimelineEvents,
  savedScenarios: mockSavedScenarios,
  selectedObjectId: null,
  selectedObjectType: null,
  filters: defaultFilters,
  currentTime: new Date(),
  isPlaying: false,
  playbackSpeed: 1,
  cameraPosition: { x: 0, y: 15, z: 20 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  sidePanelOpen: true,
  sidePanelTab: 'conflicts',

  setSelectedObject: (id, type) => set({ selectedObjectId: id, selectedObjectType: type }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () => set({ filters: defaultFilters }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setCameraPosition: (position) => set({ cameraPosition: position }),

  setCameraTarget: (target) => set({ cameraTarget: target }),

  toggleSidePanel: () => set((state) => ({ sidePanelOpen: !state.sidePanelOpen })),

  setSidePanelTab: (tab) => set({ sidePanelTab: tab }),

  resolveConflict: (conflictId) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId ? { ...c, resolved: true } : c
      ),
    })),

  saveScenario: (name, description, screenshot) => {
    const state = get();
    const newScenario: SavedScenario = {
      id: `scenario-${Date.now()}`,
      name,
      description,
      createdAt: new Date(),
      cameraPosition: state.cameraPosition,
      cameraTarget: state.cameraTarget,
      filters: state.filters,
      selectedObjects: state.selectedObjectId ? [state.selectedObjectId] : [],
      screenshot,
    };
    set((state) => ({
      savedScenarios: [...state.savedScenarios, newScenario],
    }));
  },

  loadScenario: (scenarioId) => {
    const scenario = get().savedScenarios.find((s) => s.id === scenarioId);
    if (scenario) {
      set({
        cameraPosition: scenario.cameraPosition,
        cameraTarget: scenario.cameraTarget,
        filters: scenario.filters,
        selectedObjectId: scenario.selectedObjects[0] || null,
        selectedObjectType: scenario.selectedObjects[0]?.startsWith('slot')
          ? 'slot'
          : scenario.selectedObjects[0]?.startsWith('crane')
          ? 'crane'
          : scenario.selectedObjects[0]?.startsWith('truck')
          ? 'truck'
          : null,
      });
    }
  },

  deleteScenario: (scenarioId) =>
    set((state) => ({
      savedScenarios: state.savedScenarios.filter((s) => s.id !== scenarioId),
    })),

  getStatistics: () => {
    const state = get();
    const totalSlots = state.containerSlots.length;
    const occupiedSlots = state.containerSlots.filter(
      (s) => s.status === 'occupied'
    ).length;
    const activeCranes = state.cranes.filter((c) => c.status === 'working').length;
    const activeTrucks = state.trucks.filter((t) => t.status === 'moving' || t.status === 'loading').length;
    const unresolvedConflicts = state.conflicts.filter((c) => !c.resolved);

    const typeBreakdown = state.containerSlots
      .filter((s) => s.container)
      .reduce((acc, slot) => {
        const type = slot.container!.type;
        const existing = acc.find((a) => a.type === type);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ type, count: 1 });
        }
        return acc;
      }, [] as { type: string; count: number }[]);

    return {
      totalSlots,
      occupiedSlots,
      utilizationRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      activeCranes,
      activeTrucks,
      conflicts: {
        total: unresolvedConflicts.length,
        critical: unresolvedConflicts.filter((c) => c.severity === 'critical').length,
        warning: unresolvedConflicts.filter((c) => c.severity === 'warning').length,
      },
      containerTypeBreakdown: typeBreakdown as any,
    };
  },

  getFilteredSlots: () => {
    const state = get();
    let slots = [...state.containerSlots];

    if (state.filters.containerTypes.length > 0) {
      slots = slots.filter(
        (s) => s.container && state.filters.containerTypes.includes(s.container.type)
      );
    }

    if (state.filters.slotStatuses.length > 0) {
      slots = slots.filter((s) => state.filters.slotStatuses.includes(s.status));
    }

    if (state.filters.showConflictsOnly) {
      const conflictSlotIds = state.conflicts
        .filter((c) => !c.resolved && c.type === 'slot_overlap')
        .flatMap((c) => c.affectedObjects);
      slots = slots.filter((s) => conflictSlotIds.includes(s.id));
    }

    return slots;
  },

  getFilteredCranes: () => {
    const state = get();
    let cranes = [...state.cranes];

    if (state.filters.craneStatuses.length > 0) {
      cranes = cranes.filter((c) => state.filters.craneStatuses.includes(c.status));
    }

    return cranes;
  },

  getFilteredTrucks: () => {
    const state = get();
    let trucks = [...state.trucks];

    if (state.filters.truckStatuses.length > 0) {
      trucks = trucks.filter((t) => state.filters.truckStatuses.includes(t.status));
    }

    return trucks;
  },

  getFilteredConflicts: () => {
    const state = get();
    let conflicts = state.conflicts.filter((c) => !c.resolved);

    if (state.filters.conflictTypes.length > 0) {
      conflicts = conflicts.filter((c) => state.filters.conflictTypes.includes(c.type));
    }

    return conflicts;
  },

  focusOnConflict: (conflictId) => {
    const state = get();
    const conflict = state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    set({
      selectedObjectId: conflictId,
      selectedObjectType: 'conflict',
      sidePanelOpen: true,
      sidePanelTab: 'conflicts',
    });

    if (conflict.affectedObjects.length > 0) {
      const firstObjectId = conflict.affectedObjects[0];
      let targetPos: Position = { x: 0, y: 5, z: 0 };

      const slot = state.containerSlots.find((s) => s.id === firstObjectId);
      if (slot) {
        targetPos = { x: slot.position.x, y: 5, z: slot.position.z };
      }

      const crane = state.cranes.find((c) => c.id === firstObjectId);
      if (crane) {
        targetPos = { x: crane.position.x, y: 5, z: crane.position.z };
      }

      const truck = state.trucks.find((t) => t.id === firstObjectId);
      if (truck) {
        targetPos = { x: truck.position.x, y: 5, z: truck.position.z };
      }

      set({
        cameraPosition: { x: targetPos.x + 10, y: 15, z: targetPos.z + 15 },
        cameraTarget: targetPos,
      });
    }
  },
}));
