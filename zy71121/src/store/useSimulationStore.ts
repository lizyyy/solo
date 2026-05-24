import { create } from 'zustand';
import { 
  SimulationState, 
  PlantParams, 
  RobotPath, 
  LightParams, 
  GreenhouseParams,
  ViewPreset,
  SamplePreset
} from '../types';
import { defaultState } from '../data/samples';
import { validateConfiguration } from '../utils/validation';
import { calculateHeatmap, getHeatmapStats } from '../utils/heatmap';

interface SimulationActions {
  setPlants: (plants: Partial<PlantParams>) => void;
  setRobotPath: (robotPath: Partial<RobotPath>) => void;
  setLight: (light: Partial<LightParams>) => void;
  setGreenhouse: (greenhouse: Partial<GreenhouseParams>) => void;
  setCamera: (position: [number, number, number], target: [number, number, number]) => void;
  setShowHeatmap: (show: boolean) => void;
  setCurrentView: (view: ViewPreset) => void;
  loadSample: (sample: SamplePreset) => void;
  reset: () => void;
  recalculate: () => void;
}

export const useSimulationStore = create<SimulationState & SimulationActions>((set, get) => ({
  ...defaultState,
  validation: validateConfiguration(defaultState.plants, defaultState.robotPath),
  heatmapData: calculateHeatmap(defaultState.plants, defaultState.light),
  
  setPlants: (plants) => set((state) => {
    const newPlants = { ...state.plants, ...plants };
    const validation = validateConfiguration(newPlants, state.robotPath);
    const heatmapData = calculateHeatmap(newPlants, state.light);
    return { plants: newPlants, validation, heatmapData };
  }),
  
  setRobotPath: (robotPath) => set((state) => {
    const newRobotPath = { ...state.robotPath, ...robotPath };
    const validation = validateConfiguration(state.plants, newRobotPath);
    return { robotPath: newRobotPath, validation };
  }),
  
  setLight: (light) => set((state) => {
    const newLight = { ...state.light, ...light };
    const heatmapData = calculateHeatmap(state.plants, newLight);
    return { light: newLight, heatmapData };
  }),
  
  setGreenhouse: (greenhouse) => set((state) => ({
    greenhouse: { ...state.greenhouse, ...greenhouse },
  })),
  
  setCamera: (position, target) => set({
    camera: { position, target },
  }),
  
  setShowHeatmap: (showHeatmap) => set({ showHeatmap }),
  
  setCurrentView: (currentView) => set({ currentView }),
  
  loadSample: (sample) => {
    const validation = validateConfiguration(sample.plants, sample.robotPath);
    const heatmapData = calculateHeatmap(sample.plants, defaultState.light);
    set({
      greenhouse: sample.greenhouse,
      plants: sample.plants,
      robotPath: sample.robotPath,
      light: defaultState.light,
      validation,
      heatmapData,
    });
  },
  
  reset: () => {
    const validation = validateConfiguration(defaultState.plants, defaultState.robotPath);
    const heatmapData = calculateHeatmap(defaultState.plants, defaultState.light);
    set({
      ...defaultState,
      validation,
      heatmapData,
    });
  },
  
  recalculate: () => {
    const state = get();
    const validation = validateConfiguration(state.plants, state.robotPath);
    const heatmapData = calculateHeatmap(state.plants, state.light);
    set({ validation, heatmapData });
  },
}));

export const selectHeatmapStats = () => {
  const heatmapData = useSimulationStore.getState().heatmapData;
  return getHeatmapStats(heatmapData);
};
