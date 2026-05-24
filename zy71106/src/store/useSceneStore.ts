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

interface SceneState {
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
}

export const useSceneStore = create<SceneState & SceneActions>((set, get) => ({
  roof: defaultRoof,
  trees: [],
  components: [],
  filter: defaultFilter,
  selectedComponents: [],
  camera: defaultCamera,
  viewPreset: 'overview',

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
  }),

  getFilteredComponents: () => {
    const { components, filter } = get();
    return components.filter((c) => {
      if (filter.groups.length > 0 && !filter.groups.includes(c.group)) {
        return false;
      }
      if (c.shadowStats.shadowRate < filter.shadowRateMin) {
        return false;
      }
      if (c.shadowStats.shadowRate > filter.shadowRateMax) {
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
}));
