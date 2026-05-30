import { create } from 'zustand';
import {
  SimulationConfig,
  SimulationResultPoint,
  SimulationConclusion,
  SampleData,
} from '../types/simulation';
import { runSimulation } from '../utils/odeSolver';
import { defaultConfig } from '../data/samples';

interface SimulationState {
  config: SimulationConfig;
  results: SimulationResultPoint[];
  conclusion: SimulationConclusion | null;
  selectedTimePoint: SimulationResultPoint | null;
  isDetailPanelOpen: boolean;
  
  setConfig: (config: Partial<SimulationConfig>) => void;
  setDrugConfig: (drug: Partial<SimulationConfig['drug']>) => void;
  setDosingConfig: (dosing: Partial<SimulationConfig['dosing']>) => void;
  loadSample: (sample: SampleData) => void;
  runSim: () => void;
  selectTimePoint: (point: SimulationResultPoint | null) => void;
  toggleDetailPanel: (open?: boolean) => void;
  importConfig: (config: SimulationConfig) => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  config: defaultConfig,
  results: [],
  conclusion: null,
  selectedTimePoint: null,
  isDetailPanelOpen: false,

  setConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
  },

  setDrugConfig: (drug) => {
    set((state) => ({
      config: {
        ...state.config,
        drug: { ...state.config.drug, ...drug },
      },
    }));
  },

  setDosingConfig: (dosing) => {
    set((state) => ({
      config: {
        ...state.config,
        dosing: { ...state.config.dosing, ...dosing },
      },
    }));
  },

  loadSample: (sample) => {
    set({
      config: sample.config,
      results: [],
      conclusion: null,
      selectedTimePoint: null,
    });
  },

  runSim: () => {
    const { config } = get();
    const { results, conclusion } = runSimulation(config);
    set({ results, conclusion });
  },

  selectTimePoint: (point) => {
    set({ selectedTimePoint: point, isDetailPanelOpen: point !== null });
  },

  toggleDetailPanel: (open) => {
    set((state) => ({
      isDetailPanelOpen: open ?? !state.isDetailPanelOpen,
    }));
  },

  importConfig: (config) => {
    set({
      config,
      results: [],
      conclusion: null,
      selectedTimePoint: null,
    });
  },
}));
