import { create } from 'zustand';
import {
  Roof,
  Tree,
  PVComponent,
  FilterCondition,
  CameraState,
  SceneData,
  ViewPreset,
} from '../types';
import { sampleScene } from '../data/sampleScenes';
import { shadowCalculator, DayShadowCalculationResult } from '../utils/shadowCalculator';

export interface RealTimeShadowResult {
  componentId: string;
  shadowRate: number;
  shadowedPoints: number;
  totalPoints: number;
}

export interface AccumulatedShadowData {
  componentId: string;
  accumulatedShadowHours: number;
  lastProcessedHour: number;
}

export interface ShadowCalculationState {
  realTimeShadows: RealTimeShadowResult[];
  isCalculating: boolean;
  lastCalculationTime: number;
  accumulatedShadows: AccumulatedShadowData[];
  currentTrackingMonth: number;
  currentTrackingDay: number;
  dayShadowCache: DayShadowCalculationResult | null;
  isDayCalculated: boolean;
}

const defaultRoof: Roof = {
  width: 30,
  depth: 20,
  height: 10,
  parapetHeight: 1.2,
  slope: 15,
};

const defaultCamera: CameraState = {
  position: { x: 25, y: 25, z: 25 },
  target: { x: 0, y: 10, z: 0 },
};

const defaultFilter: FilterCondition = {
  groups: [],
  shadowRateMin: 0,
  shadowRateMax: 100,
};

interface SceneState extends ShadowCalculationState {
  roof: Roof;
  trees: Tree[];
  components: PVComponent[];
  filter: FilterCondition;
  selectedComponents: string[];
  camera: CameraState;
  viewPreset: ViewPreset;
}

interface SceneActions {
  setRoof: (roof: Roof) => void;
  addTree: (tree: Tree) => void;
  removeTree: (id: string) => void;
  updateTree: (id: string, updates: Partial<Tree>) => void;
  setComponents: (components: PVComponent[]) => void;
  updateComponent: (id: string, updates: Partial<PVComponent>) => void;
  setFilter: (filter: FilterCondition) => void;
  resetFilter: () => void;
  toggleComponentSelection: (id: string) => void;
  selectAllComponents: () => void;
  deselectAllComponents: () => void;
  setCamera: (camera: CameraState) => void;
  setViewPreset: (preset: ViewPreset) => void;
  loadScene: (scene: SceneData) => void;
  loadSample: () => void;
  reset: () => void;
  getFilteredComponents: () => PVComponent[];
  getComponentGroups: () => string[];
  updateRealTimeShadows: (results: RealTimeShadowResult[]) => void;
  setIsCalculating: (isCalculating: boolean) => void;
  getComponentShadowRate: (componentId: string) => number;
  calculateDayShadows: (month: number, day: number) => Promise<void>;
  updateForTimeChange: (month: number, day: number, hour: number) => void;
  getComponentAccumulatedShadowHours: (componentId: string) => number;
  resetAccumulatedShadows: () => void;
  getAverageAccumulatedShadowHours: () => number;
  invalidateShadowCache: () => void;
}

export const useSceneStore = create<SceneState & SceneActions>((set, get) => ({
  roof: defaultRoof,
  trees: [],
  components: [],
  filter: defaultFilter,
  selectedComponents: [],
  camera: defaultCamera,
  viewPreset: 'overview',
  realTimeShadows: [],
  isCalculating: false,
  lastCalculationTime: 0,
  accumulatedShadows: [],
  currentTrackingMonth: 6,
  currentTrackingDay: 15,
  dayShadowCache: null,
  isDayCalculated: false,

  setRoof: (roof) => set((state) => {
    shadowCalculator.updateOccluders(state.trees, roof);
    return { roof, dayShadowCache: null, isDayCalculated: false };
  }),

  addTree: (tree) => set((state) => {
    const newTrees = [...state.trees, tree];
    shadowCalculator.updateOccluders(newTrees, state.roof);
    return { trees: newTrees, dayShadowCache: null, isDayCalculated: false };
  }),

  removeTree: (id) => set((state) => {
    const newTrees = state.trees.filter((t) => t.id !== id);
    shadowCalculator.updateOccluders(newTrees, state.roof);
    return { trees: newTrees, dayShadowCache: null, isDayCalculated: false };
  }),

  updateTree: (id, updates) => set((state) => {
    const newTrees = state.trees.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    shadowCalculator.updateOccluders(newTrees, state.roof);
    return { trees: newTrees, dayShadowCache: null, isDayCalculated: false };
  }),

  setComponents: (components) => set({ components, dayShadowCache: null, isDayCalculated: false }),

  updateComponent: (id, updates) => set((state) => ({
    components: state.components.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
    dayShadowCache: null,
    isDayCalculated: false,
  })),

  setFilter: (filter) => set({ filter }),

  resetFilter: () => set({ filter: defaultFilter }),

  toggleComponentSelection: (id) => set((state) => {
    const index = state.selectedComponents.indexOf(id);
    if (index > -1) {
      return {
        selectedComponents: state.selectedComponents.filter((s) => s !== id),
      };
    }
    return {
      selectedComponents: [...state.selectedComponents, id],
    };
  }),

  selectAllComponents: () => set((state) => ({
    selectedComponents: state.components.map((c) => c.id),
  })),

  deselectAllComponents: () => set({ selectedComponents: [] }),

  setCamera: (camera) => set({ camera }),

  setViewPreset: (viewPreset) => set({ viewPreset }),

  loadScene: (scene) => {
    shadowCalculator.updateOccluders(scene.trees, scene.roof);
    set({
      roof: scene.roof,
      trees: scene.trees,
      components: scene.components,
      dayShadowCache: null,
      isDayCalculated: false,
    });
  },

  loadSample: () => {
    shadowCalculator.updateOccluders(sampleScene.trees, sampleScene.roof);
    set({
      roof: sampleScene.roof,
      trees: sampleScene.trees,
      components: sampleScene.components,
      dayShadowCache: null,
      isDayCalculated: false,
    });
  },

  reset: () => {
    shadowCalculator.updateOccluders([], defaultRoof);
    set({
      roof: defaultRoof,
      trees: [],
      components: [],
      filter: defaultFilter,
      selectedComponents: [],
      camera: defaultCamera,
      viewPreset: 'overview',
      realTimeShadows: [],
      isCalculating: false,
      lastCalculationTime: 0,
      accumulatedShadows: [],
      currentTrackingMonth: 6,
      currentTrackingDay: 15,
      dayShadowCache: null,
      isDayCalculated: false,
    });
  },

  getFilteredComponents: () => {
    const { components, filter, realTimeShadows } = get();
    return components.filter((c) => {
      if (filter.groups.length > 0 && !filter.groups.includes(c.group)) {
        return false;
      }
      const shadowResult = realTimeShadows.find((s) => s.componentId === c.id);
      const shadowRate = shadowResult ? shadowResult.shadowRate : 0;
      if (shadowRate < filter.shadowRateMin) {
        return false;
      }
      if (shadowRate > filter.shadowRateMax) {
        return false;
      }
      return true;
    });
  },

  getComponentGroups: () => {
    const { components } = get();
    const groups = new Set(components.map((c) => c.group));
    return Array.from(groups).sort();
  },

  updateRealTimeShadows: (results: RealTimeShadowResult[]) => set({
    realTimeShadows: results,
    lastCalculationTime: Date.now(),
  }),

  setIsCalculating: (isCalculating: boolean) => set({ isCalculating }),

  getComponentShadowRate: (componentId: string) => {
    const { realTimeShadows } = get();
    const shadowResult = realTimeShadows.find((s) => s.componentId === componentId);
    return shadowResult ? shadowResult.shadowRate : 0;
  },

  calculateDayShadows: async (month: number, day: number) => {
    const state = get();
    
    if (state.dayShadowCache && 
        state.dayShadowCache.month === month && 
        state.dayShadowCache.day === day) {
      return;
    }

    if (state.components.length === 0) return;

    set({ isCalculating: true });

    await new Promise(resolve => setTimeout(resolve, 10));

    shadowCalculator.updateOccluders(state.trees, state.roof);
    const result = shadowCalculator.calculateDayAccumulatedShadows(
      state.components,
      month,
      day,
      39.9,
      0.25,
      3
    );

    set({
      dayShadowCache: result,
      isDayCalculated: true,
      currentTrackingMonth: month,
      currentTrackingDay: day,
      isCalculating: false,
    });
  },

  updateForTimeChange: (month: number, day: number, hour: number) => {
    const state = get();

    const dayChanged = state.currentTrackingMonth !== month || state.currentTrackingDay !== day;
    
    if (dayChanged || !state.dayShadowCache || !state.isDayCalculated) {
      shadowCalculator.updateOccluders(state.trees, state.roof);
      const result = shadowCalculator.calculateDayAccumulatedShadows(
        state.components,
        month,
        day,
        39.9,
        0.25,
        3
      );

      const accumulatedUntilHour = shadowCalculator.calculateAccumulatedUntilHour(result, hour);

      set({
        dayShadowCache: result,
        isDayCalculated: true,
        accumulatedShadows: accumulatedUntilHour,
        currentTrackingMonth: month,
        currentTrackingDay: day,
      });
    } else if (state.dayShadowCache) {
      const accumulatedUntilHour = shadowCalculator.calculateAccumulatedUntilHour(
        state.dayShadowCache,
        hour
      );
      set({
        accumulatedShadows: accumulatedUntilHour,
      });
    }
  },

  getComponentAccumulatedShadowHours: (componentId: string) => {
    const { accumulatedShadows } = get();
    const accumulated = accumulatedShadows.find((a) => a.componentId === componentId);
    return accumulated ? accumulated.accumulatedShadowHours : 0;
  },

  resetAccumulatedShadows: () => {
    const { components } = get();
    set({
      accumulatedShadows: components.map((c) => ({
        componentId: c.id,
        accumulatedShadowHours: 0,
        lastProcessedHour: 6,
      })),
    });
  },

  getAverageAccumulatedShadowHours: () => {
    const { accumulatedShadows, components } = get();
    if (accumulatedShadows.length > 0) {
      return (
        accumulatedShadows.reduce((sum, a) => sum + a.accumulatedShadowHours, 0) /
        accumulatedShadows.length
      );
    }
    return 0;
  },

  invalidateShadowCache: () => set({
    dayShadowCache: null,
    isDayCalculated: false,
  }),
}));
