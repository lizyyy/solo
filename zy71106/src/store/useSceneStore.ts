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
  accumulateShadowDuration: (month: number, day: number, hour: number, deltaHours: number) => void;
  getComponentAccumulatedShadowHours: (componentId: string) => number;
  resetAccumulatedShadows: () => void;
  getAverageAccumulatedShadowHours: () => number;
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

  setRoof: (roof) => set({ roof }),

  addTree: (tree) => set((state) => ({ trees: [...state.trees, tree] })),

  removeTree: (id) => set((state) => ({
    trees: state.trees.filter((t) => t.id !== id),
  })),

  updateTree: (id, updates) => set((state) => ({
    trees: state.trees.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    ),
  })),

  setComponents: (components) => set({ components }),

  updateComponent: (id, updates) => set((state) => ({
    components: state.components.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    ),
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

  loadScene: (scene) => set({
    roof: scene.roof,
    trees: scene.trees,
    components: scene.components,
  }),

  loadSample: () => set({
    roof: sampleScene.roof,
    trees: sampleScene.trees,
    components: sampleScene.components,
  }),

  reset: () => set({
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
  }),

  getFilteredComponents: () => {
    const { components, filter, realTimeShadows } = get();
    return components.filter((c) => {
      if (filter.groups.length > 0 && !filter.groups.includes(c.group)) {
        return false;
      }
      const shadowResult = realTimeShadows.find((s) => s.componentId === c.id);
      const shadowRate = shadowResult ? shadowResult.shadowRate : c.shadowStats.shadowRate;
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
    const { realTimeShadows, components } = get();
    const shadowResult = realTimeShadows.find((s) => s.componentId === componentId);
    if (shadowResult) {
      return shadowResult.shadowRate;
    }
    const component = components.find((c) => c.id === componentId);
    return component ? component.shadowStats.shadowRate : 0;
  },

  accumulateShadowDuration: (month: number, day: number, hour: number, deltaHours: number) => {
    const safeDelta = Math.min(deltaHours, 0.1);

    set((state) => {
      let newAccumulated = [...state.accumulatedShadows];

      if (state.currentTrackingMonth !== month || state.currentTrackingDay !== day) {
        newAccumulated = state.components.map((c) => ({
          componentId: c.id,
          accumulatedShadowHours: 0,
          lastProcessedHour: hour,
        }));
        return {
          accumulatedShadows: newAccumulated,
          currentTrackingMonth: month,
          currentTrackingDay: day,
        };
      }

      newAccumulated = state.components.map((comp) => {
        const existing = state.accumulatedShadows.find((a) => a.componentId === comp.id);
        const shadowRate = state.getComponentShadowRate(comp.id);
        const shadowHours = (shadowRate / 100) * safeDelta;
        return {
          componentId: comp.id,
          accumulatedShadowHours: (existing?.accumulatedShadowHours || 0) + shadowHours,
          lastProcessedHour: hour,
        };
      });

      return {
        accumulatedShadows: newAccumulated,
        currentTrackingMonth: month,
        currentTrackingDay: day,
      };
    });
  },

  getComponentAccumulatedShadowHours: (componentId: string) => {
    const { accumulatedShadows, components } = get();
    const accumulated = accumulatedShadows.find((a) => a.componentId === componentId);
    if (accumulated) {
      return accumulated.accumulatedShadowHours;
    }
    const component = components.find((c) => c.id === componentId);
    return component ? component.shadowStats.shadowHours : 0;
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
    if (components.length === 0) return 0;
    return (
      components.reduce((sum, c) => sum + c.shadowStats.shadowHours, 0) / components.length
    );
  },
}));
