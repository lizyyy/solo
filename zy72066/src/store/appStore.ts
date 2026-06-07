import { create } from 'zustand';
import { AppState, AppActions, Solution, ParameterConfig, DeviceData } from '../types';
import { defaultConfig, sampleSolutions, sampleDevicesSmooth } from '../data/mockData';
import { detectAllAnomalies } from '../utils/anomalyDetector';
import { v4 as uuidv4 } from 'uuid';

type AppStore = AppState & AppActions;

const initialState: AppState = {
  currentSolution: null,
  currentConfig: defaultConfig,
  solutions: sampleSolutions,
  selectedFloor: null,
  selectedDevice: null,
  filterConditions: {},
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  setCurrentSolution: (solution) => {
    if (solution) {
      const anomalies = detectAllAnomalies(solution.devices, get().currentConfig);
      set({ 
        currentSolution: { ...solution, anomalies },
        selectedFloor: null,
        selectedDevice: null,
      });
    } else {
      set({ currentSolution: null, selectedFloor: null, selectedDevice: null });
    }
  },

  setCurrentConfig: (config) => {
    set({ currentConfig: config });
    const { currentSolution } = get();
    if (currentSolution) {
      const anomalies = detectAllAnomalies(currentSolution.devices, config);
      set({ currentSolution: { ...currentSolution, anomalies } });
    }
  },

  updateConfig: (updates) => {
    const newConfig = { 
      ...get().currentConfig, 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    set({ currentConfig: newConfig });
    const { currentSolution } = get();
    if (currentSolution) {
      const anomalies = detectAllAnomalies(currentSolution.devices, newConfig);
      set({ currentSolution: { ...currentSolution, anomalies } });
    }
  },

  addSolution: (solution) => {
    set((state) => ({
      solutions: [...state.solutions, solution],
    }));
  },

  updateSolution: (id, updates) => {
    set((state) => ({
      solutions: state.solutions.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
      currentSolution:
        state.currentSolution?.id === id
          ? { ...state.currentSolution, ...updates, updatedAt: new Date().toISOString() }
          : state.currentSolution,
    }));
  },

  setSelectedFloor: (floor) => {
    set({ selectedFloor: floor, selectedDevice: null });
  },

  setSelectedDevice: (device) => {
    set({ selectedDevice: device });
  },

  setFilterConditions: (conditions) => {
    set((state) => ({
      filterConditions: { ...state.filterConditions, ...conditions },
    }));
  },

  resolveAnomaly: (anomalyId, remark) => {
    const { currentSolution, solutions } = get();
    if (!currentSolution) return;

    const updatedAnomalies = currentSolution.anomalies.map((a) =>
      a.id === anomalyId ? { ...a, resolved: true, remark } : a
    );

    const updatedSolution = { 
      ...currentSolution, 
      anomalies: updatedAnomalies,
      updatedAt: new Date().toISOString(),
    };

    set({
      currentSolution: updatedSolution,
      solutions: solutions.map((s) =>
        s.id === currentSolution.id ? updatedSolution : s
      ),
    });
  },

  addRemark: (remark) => {
    const { currentSolution, solutions } = get();
    if (!currentSolution) return;

    const updatedSolution = {
      ...currentSolution,
      remarks: [...currentSolution.remarks, remark],
      updatedAt: new Date().toISOString(),
    };

    set({
      currentSolution: updatedSolution,
      solutions: solutions.map((s) =>
        s.id === currentSolution.id ? updatedSolution : s
      ),
    });
  },

  detectAnomalies: () => {
    const { currentSolution, currentConfig } = get();
    if (!currentSolution) return [];
    return detectAllAnomalies(currentSolution.devices, currentConfig);
  },
}));

export function createNewSolution(
  name: string,
  devices: DeviceData[],
  config: ParameterConfig
): Solution {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    configId: config.id,
    devices,
    anomalies: detectAllAnomalies(devices, config),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    operator: '林老师',
    remarks: [],
  };
}
