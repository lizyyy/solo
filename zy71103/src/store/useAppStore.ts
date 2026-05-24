import { create } from 'zustand';
import type {
  AppState,
  BaseElement,
  PathPoint,
  TimelineStep,
  SceneData,
  SceneElement,
  FilterState,
} from '../types';
import { sampleScenes, defaultScene, generateId } from '../data/samples';
import { detectCollisions } from '../utils/collision';
import { downloadTextReport, downloadJSON } from '../utils/exportReport';

const addVisibleProperty = (element: any): any => ({
  ...element,
  visible: element.visible !== undefined ? element.visible : true,
});

const prepareSceneData = (scene: SceneData): SceneData => {
  const elements = scene.elements.map(addVisibleProperty) as SceneElement[];
  const errors = detectCollisions(elements);
  return { ...scene, elements, errors };
};

const initialScene = prepareSceneData(JSON.parse(JSON.stringify(sampleScenes['standard-or'])));

const calculateTotalDuration = (sceneData: SceneData): number => {
  let maxTime = 0;
  sceneData.elements.forEach((element) => {
    if (element.type === 'staff' && element.path.length > 0) {
      const lastPoint = element.path[element.path.length - 1];
      maxTime = Math.max(maxTime, lastPoint.timestamp);
    }
  });
  return maxTime;
};

const defaultFilters: FilterState = {
  showInstrumentCarts: true,
  showSterileZones: true,
  showRecycleBins: true,
  showStaff: true,
  showPaths: true,
  showErrors: true,
};

export const useAppStore = create<AppState>((set, get) => ({
  sceneData: initialScene,
  selectedElementId: null,
  hoveredElementId: null,
  isPlaying: false,
  currentTime: 0,
  totalDuration: calculateTotalDuration(initialScene),
  editMode: 'select',
  cameraView: 'free',
  filters: defaultFilters,
  isDragging: false,

  setSelectedElement: (id: string | null) => {
    set({ selectedElementId: id });
  },

  setHoveredElement: (id: string | null) => {
    set({ hoveredElementId: id });
  },

  updateElement: (id: string, updates: Partial<BaseElement>) => {
    set((state) => {
      const newElements = state.sceneData.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ) as SceneElement[];
      const newSceneData: SceneData = { ...state.sceneData, elements: newElements };
      const errors = detectCollisions(newElements);
      newSceneData.errors = errors;
      return {
        sceneData: newSceneData,
        totalDuration: calculateTotalDuration(newSceneData),
      };
    });
  },

  addElement: (element: BaseElement) => {
    set((state) => {
      const newElement = addVisibleProperty(element) as SceneElement;
      const newElements = [...state.sceneData.elements, newElement];
      const newSceneData: SceneData = { ...state.sceneData, elements: newElements };
      const errors = detectCollisions(newElements);
      newSceneData.errors = errors;
      return {
        sceneData: newSceneData,
        selectedElementId: element.id,
        totalDuration: calculateTotalDuration(newSceneData),
      };
    });
  },

  removeElement: (id: string) => {
    set((state) => {
      const newElements = state.sceneData.elements.filter((el) => el.id !== id);
      const newTimeline = state.sceneData.timeline.filter(
        (step) => step.staffId !== id
      );
      const newSceneData = {
        ...state.sceneData,
        elements: newElements,
        timeline: newTimeline,
      };
      const errors = detectCollisions(newElements);
      newSceneData.errors = errors;
      return {
        sceneData: newSceneData,
        selectedElementId:
          state.selectedElementId === id ? null : state.selectedElementId,
        totalDuration: calculateTotalDuration(newSceneData),
      };
    });
  },

  toggleElementVisibility: (id: string) => {
    set((state) => {
      const newElements = state.sceneData.elements.map((el) =>
        el.id === id ? { ...el, visible: !el.visible } : el
      ) as SceneElement[];
      return {
        sceneData: { ...state.sceneData, elements: newElements },
      };
    });
  },

  setFilters: (filters: Partial<FilterState>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  addPathPoint: (staffId: string, point: PathPoint) => {
    set((state) => {
      const newElements = state.sceneData.elements.map((el) => {
        if (el.id === staffId && el.type === 'staff') {
          const newPath = [...el.path, point].sort(
            (a, b) => a.timestamp - b.timestamp
          );
          return { ...el, path: newPath };
        }
        return el;
      });
      const newSceneData = { ...state.sceneData, elements: newElements };
      const errors = detectCollisions(newElements);
      newSceneData.errors = errors;
      return {
        sceneData: newSceneData,
        totalDuration: calculateTotalDuration(newSceneData),
      };
    });
  },

  removePathPoint: (staffId: string, pointId: string) => {
    set((state) => {
      const newElements = state.sceneData.elements.map((el) => {
        if (el.id === staffId && el.type === 'staff') {
          return { ...el, path: el.path.filter((p) => p.id !== pointId) };
        }
        return el;
      });
      const newSceneData = { ...state.sceneData, elements: newElements };
      const errors = detectCollisions(newElements);
      newSceneData.errors = errors;
      return {
        sceneData: newSceneData,
        totalDuration: calculateTotalDuration(newSceneData),
      };
    });
  },

  updatePathPoint: (staffId: string, pointId: string, updates: Partial<PathPoint>) => {
    set((state) => {
      const newElements = state.sceneData.elements.map((el) => {
        if (el.id === staffId && el.type === 'staff') {
          const newPath = el.path
            .map((p) => (p.id === pointId ? { ...p, ...updates } : p))
            .sort((a, b) => a.timestamp - b.timestamp);
          return { ...el, path: newPath };
        }
        return el;
      });
      const newSceneData = { ...state.sceneData, elements: newElements };
      const errors = detectCollisions(newElements);
      newSceneData.errors = errors;
      return {
        sceneData: newSceneData,
        totalDuration: calculateTotalDuration(newSceneData),
      };
    });
  },

  setPlayState: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setCurrentTime: (time: number) => {
    set((state) => ({
      currentTime: Math.max(0, Math.min(time, state.totalDuration)),
    }));
  },

  setEditMode: (mode: AppState['editMode']) => {
    set({ editMode: mode });
  },

  setCameraView: (view: AppState['cameraView']) => {
    set({ cameraView: view });
  },

  setIsDragging: (dragging: boolean) => {
    set({ isDragging: dragging });
  },

  loadSample: (sampleId: string) => {
    const sample = sampleScenes[sampleId] || defaultScene;
    const sceneData = prepareSceneData(JSON.parse(JSON.stringify(sample)));
    set({
      sceneData,
      selectedElementId: null,
      isPlaying: false,
      currentTime: 0,
      totalDuration: calculateTotalDuration(sceneData),
      filters: defaultFilters,
    });
  },

  resetScene: () => {
    const sceneData = prepareSceneData(JSON.parse(JSON.stringify(defaultScene)));
    set({
      sceneData,
      selectedElementId: null,
      hoveredElementId: null,
      isPlaying: false,
      currentTime: 0,
      totalDuration: 0,
      editMode: 'select',
      filters: defaultFilters,
      isDragging: false,
    });
  },

  exportReport: () => {
    const { sceneData } = get();
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadTextReport(sceneData, `动线报告_${timestamp}.txt`);
    downloadJSON(sceneData, `动线数据_${timestamp}.json`);
  },

  detectErrors: () => {
    set((state) => {
      const errors = detectCollisions(state.sceneData.elements);
      const newSceneData = { ...state.sceneData, errors };
      return { sceneData: newSceneData };
    });
  },

  addTimelineStep: (step: TimelineStep) => {
    set((state) => ({
      sceneData: {
        ...state.sceneData,
        timeline: [...state.sceneData.timeline, step],
      },
    }));
  },

  removeTimelineStep: (stepId: string) => {
    set((state) => ({
      sceneData: {
        ...state.sceneData,
        timeline: state.sceneData.timeline.filter((s) => s.id !== stepId),
      },
    }));
  },
}));

export { generateId };
