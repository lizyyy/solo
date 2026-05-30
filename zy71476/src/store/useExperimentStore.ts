import { create } from 'zustand';
import {
  ExperimentState,
  ExperimentParams,
  ForceAnalysis,
  ThresholdResult,
  ErrorRecord,
  ConflictRecord,
  SelectedObject,
  DEFAULT_PARAMS,
  ERROR_MESSAGES,
} from '../types';
import { calculateForces, determineStatus, detectConflicts } from '../utils/physics';
import { validateParams, sanitizeParams } from '../utils/validation';

interface ExperimentStore extends ExperimentState {
  setParams: (params: Partial<ExperimentParams>) => void;
  setSelectedObject: (obj: SelectedObject) => void;
  setIsPlaying: (playing: boolean) => void;
  setBlockPosition: (pos: number) => void;
  addErrorTrace: (error: ErrorRecord) => void;
  addConflictTrace: (conflict: ConflictRecord) => void;
  resolveError: (errorId: string) => void;
  resetExperiment: () => void;
  clearTraces: () => void;
  updateForcesAndThreshold: (params: ExperimentParams) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const useExperimentStore = create<ExperimentStore>((set, get) => {
  const initialParams = sanitizeParams(DEFAULT_PARAMS);
  const initialForces = calculateForces(initialParams);
  const initialThreshold = determineStatus(initialParams);

  return {
    params: initialParams,
    forces: initialForces,
    threshold: initialThreshold,
    selectedObject: null,
    errorTraces: [],
    conflictTraces: [],
    isPlaying: false,
    blockPosition: 0,

    updateForcesAndThreshold: (params: ExperimentParams) => {
      const forces = calculateForces(params);
      const threshold = determineStatus(params);
      set({ forces, threshold });

      const conflict = detectConflicts(params, forces, threshold);
      if (conflict) {
        get().addConflictTrace(conflict);
      }
    },

    setParams: (newParams: Partial<ExperimentParams>) => {
      const currentParams = get().params;
      const updatedParams = { ...currentParams, ...newParams };
      const sanitized = sanitizeParams(updatedParams);

      const errors = validateParams(updatedParams);
      if (errors.length > 0) {
        errors.forEach(error => get().addErrorTrace(error));
      }

      set({ params: sanitized });
      get().updateForcesAndThreshold(sanitized);

      if (get().threshold.status !== 'sliding') {
        set({ blockPosition: 0, isPlaying: false });
      }
    },

    setSelectedObject: (obj: SelectedObject) => {
      set({ selectedObject: obj });
    },

    setIsPlaying: (playing: boolean) => {
      set({ isPlaying: playing });
    },

    setBlockPosition: (pos: number) => {
      set({ blockPosition: pos });
    },

    addErrorTrace: (error: ErrorRecord) => {
      const existingErrors = get().errorTraces;
      const isDuplicate = existingErrors.some(
        e => e.type === error.type &&
             Math.abs(e.timestamp - error.timestamp) < 1000 &&
             e.params.angle === error.params.angle &&
             e.params.mass === error.params.mass &&
             e.params.frictionCoefficient === error.params.frictionCoefficient
      );

      if (!isDuplicate) {
        set(state => ({
          errorTraces: [...state.errorTraces, error].slice(-50),
        }));
      }
    },

    addConflictTrace: (conflict: ConflictRecord) => {
      const existingConflicts = get().conflictTraces;
      const isDuplicate = existingConflicts.some(
        c => Math.abs(c.timestamp - conflict.timestamp) < 1000 &&
             c.finalJudgment === conflict.finalJudgment
      );

      if (!isDuplicate) {
        set(state => ({
          conflictTraces: [...state.conflictTraces, conflict].slice(-20),
        }));

        const conflictError: ErrorRecord = {
          id: generateId(),
          timestamp: conflict.timestamp,
          type: 'conflict',
          message: ERROR_MESSAGES.conflict,
          params: get().params,
          resolved: true,
        };
        get().addErrorTrace(conflictError);
      }
    },

    resolveError: (errorId: string) => {
      set(state => ({
        errorTraces: state.errorTraces.map(e =>
          e.id === errorId ? { ...e, resolved: true } : e
        ),
      }));
    },

    resetExperiment: () => {
      const defaultParams = sanitizeParams(DEFAULT_PARAMS);
      const defaultForces = calculateForces(defaultParams);
      const defaultThreshold = determineStatus(defaultParams);

      set({
        params: defaultParams,
        forces: defaultForces,
        threshold: defaultThreshold,
        selectedObject: null,
        isPlaying: false,
        blockPosition: 0,
      });
    },

    clearTraces: () => {
      set({
        errorTraces: [],
        conflictTraces: [],
      });
    },
  };
});
