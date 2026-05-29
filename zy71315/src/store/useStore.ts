import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Experiment, AppState, AppActions, DataStatus, Peak } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

type Store = AppState & AppActions;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      experiments: [],
      currentExperimentId: null,
      comparisonIds: [],
      isPlaying: false,
      showComparison: false,

      setCurrentExperiment: (id: string | null) => {
        set({ currentExperimentId: id });
      },

      addExperiment: (experiment) => {
        const newExperiment: Experiment = {
          ...experiment,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          experiments: [...state.experiments, newExperiment],
          currentExperimentId: newExperiment.id,
        }));
      },

      updateExperiment: (id: string, updates: Partial<Experiment>) => {
        set((state) => ({
          experiments: state.experiments.map((exp) =>
            exp.id === id
              ? { ...exp, ...updates, updatedAt: new Date().toISOString() }
              : exp
          ),
        }));
      },

      deleteExperiment: (id: string) => {
        set((state) => ({
          experiments: state.experiments.filter((exp) => exp.id !== id),
          currentExperimentId:
            state.currentExperimentId === id ? null : state.currentExperimentId,
          comparisonIds: state.comparisonIds.filter((cid) => cid !== id),
        }));
      },

      duplicateExperiment: (id: string) => {
        const { experiments } = get();
        const original = experiments.find((exp) => exp.id === id);
        if (original) {
          const duplicate: Experiment = {
            ...original,
            id: generateId(),
            name: `${original.name} (副本)`,
            version: `${parseFloat(original.version) + 0.1}`,
            parentId: original.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'tentative',
          };
          set((state) => ({
            experiments: [...state.experiments, duplicate],
            currentExperimentId: duplicate.id,
          }));
        }
      },

      toggleComparison: (id: string) => {
        set((state) => {
          const isInComparison = state.comparisonIds.includes(id);
          return {
            comparisonIds: isInComparison
              ? state.comparisonIds.filter((cid) => cid !== id)
              : [...state.comparisonIds, id],
          };
        });
      },

      clearComparison: () => {
        set({ comparisonIds: [], showComparison: false });
      },

      setIsPlaying: (playing: boolean) => {
        set({ isPlaying: playing });
      },

      setShowComparison: (show: boolean) => {
        set({ showComparison: show });
      },

      updatePeakStatus: (experimentId: string, peakId: string, status: DataStatus) => {
        const { experiments } = get();
        const experiment = experiments.find((exp) => exp.id === experimentId);
        if (experiment) {
          const updatedPeaks = experiment.peaks.map((peak: Peak) =>
            peak.id === peakId ? { ...peak, status } : peak
          );
          get().updateExperiment(experimentId, { peaks: updatedPeaks });
        }
      },

      markPeakAsNoise: (experimentId: string, peakId: string, isNoise: boolean) => {
        const { experiments } = get();
        const experiment = experiments.find((exp) => exp.id === experimentId);
        if (experiment) {
          const updatedPeaks = experiment.peaks.map((peak: Peak) =>
            peak.id === peakId ? { ...peak, isNoise, status: 'confirmed' as DataStatus } : peak
          );
          get().updateExperiment(experimentId, { peaks: updatedPeaks });
        }
      },

      addNote: (experimentId: string, note: string) => {
        get().updateExperiment(experimentId, { notes: note });
      },
    }),
    {
      name: 'tuning-fork-storage',
      partialize: (state) => ({
        experiments: state.experiments,
        currentExperimentId: state.currentExperimentId,
      }),
    }
  )
);

export const useCurrentExperiment = () => {
  const { experiments, currentExperimentId } = useStore();
  return experiments.find((exp) => exp.id === currentExperimentId) || null;
};

export const useComparisonExperiments = () => {
  const { experiments, comparisonIds } = useStore();
  return experiments.filter((exp) => comparisonIds.includes(exp.id));
};
