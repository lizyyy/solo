import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppState,
  ExperimentConfig,
  ExperimentResult,
  SavedExperiment,
  BPlusTreeVisualization,
  HashVisualization,
} from '../types';

const STORAGE_KEY = 'index-simulator-store';

interface AppActions {
  setCurrentExperiment: (config: ExperimentConfig | null) => void;
  setCurrentResult: (result: ExperimentResult | null) => void;
  setSavedExperiments: (experiments: SavedExperiment[]) => void;
  addSavedExperiment: (experiment: SavedExperiment) => void;
  updateSavedExperiment: (id: string, updates: Partial<SavedExperiment>) => void;
  removeSavedExperiment: (id: string) => void;
  setBPlusVisualization: (viz: BPlusTreeVisualization | null) => void;
  setHashVisualization: (viz: HashVisualization | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  reset: () => void;
}

const initialState: AppState = {
  currentExperiment: null,
  currentResult: null,
  savedExperiments: [],
  bplusVisualization: null,
  hashVisualization: null,
  isLoading: false,
  error: null,
  activeTab: 'config',
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentExperiment: (config) => {
        set({ currentExperiment: config });
      },

      setCurrentResult: (result) => {
        set({ currentResult: result });
        
        if (result) {
          const { currentExperiment, savedExperiments } = get();
          if (currentExperiment) {
            const existingIndex = savedExperiments.findIndex(e => e.id === result.experimentId);
            if (existingIndex >= 0) {
              get().updateSavedExperiment(result.experimentId, { result });
            } else {
              get().addSavedExperiment({
                id: result.experimentId,
                name: currentExperiment.name,
                createdAt: Date.now(),
                config: currentExperiment,
                result,
              });
            }
          }
        }
      },

      setSavedExperiments: (experiments) => {
        set({ savedExperiments: experiments });
      },

      addSavedExperiment: (experiment) => {
        set((state) => ({
          savedExperiments: [...state.savedExperiments, experiment],
        }));
      },

      updateSavedExperiment: (id, updates) => {
        set((state) => ({
          savedExperiments: state.savedExperiments.map((exp) =>
            exp.id === id ? { ...exp, ...updates } : exp
          ),
        }));
      },

      removeSavedExperiment: (id) => {
        set((state) => ({
          savedExperiments: state.savedExperiments.filter((exp) => exp.id !== id),
        }));
      },

      setBPlusVisualization: (viz) => {
        set({ bplusVisualization: viz });
      },

      setHashVisualization: (viz) => {
        set({ hashVisualization: viz });
      },

      setIsLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        savedExperiments: state.savedExperiments,
      }),
    }
  )
);

export default useAppStore;
