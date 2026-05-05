import { create } from 'zustand';
import {
  SimulationConfig,
  SimulationResult,
  Example,
} from '../types';

interface AppState {
  config: SimulationConfig;
  result: SimulationResult | null;
  examples: Example[];
  isLoading: boolean;
  error: string | null;
  activeTab: 'config' | 'visualization' | 'metrics' | 'export';
  selectedPrimitive: 'mutex' | 'rwlock' | 'spinlock' | 'cas' | 'lock-free-queue' | 'aba';

  setConfig: (config: Partial<SimulationConfig>) => void;
  setResult: (result: SimulationResult | null) => void;
  setExamples: (examples: Example[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: 'config' | 'visualization' | 'metrics' | 'export') => void;
  setSelectedPrimitive: (primitive: 'mutex' | 'rwlock' | 'spinlock' | 'cas' | 'lock-free-queue' | 'aba') => void;
  resetConfig: () => void;
  clearResult: () => void;
}

const defaultConfig: SimulationConfig = {
  threadCount: 2,
  lockType: 'mutex',
  operationSequence: [],
  contentionLevel: 'medium',
  enableABAReproduction: false,
  abaSteps: [],
  duration: 10,
};

export const useAppStore = create<AppState>((set) => ({
  config: defaultConfig,
  result: null,
  examples: [],
  isLoading: false,
  error: null,
  activeTab: 'config',
  selectedPrimitive: 'mutex',

  setConfig: (newConfig) =>
    set((state) => ({
      config: { ...state.config, ...newConfig },
    })),

  setResult: (result) => set({ result }),

  setExamples: (examples) => set({ examples }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedPrimitive: (primitive) =>
    set((state) => ({
      selectedPrimitive: primitive,
      config: {
        ...state.config,
        lockType: primitive === 'aba' ? 'cas' : primitive,
        enableABAReproduction: primitive === 'aba',
      },
    })),

  resetConfig: () => set({ config: defaultConfig, result: null }),

  clearResult: () => set({ result: null }),
}));
