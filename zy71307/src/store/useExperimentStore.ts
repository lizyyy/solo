import { create } from 'zustand';
import type {
  Experiment,
  DataPoint,
  FittingParams,
  EnvironmentParams,
  AnomalyPoint,
  FittingResult,
  EfficiencyResult,
  FilterConditions,
} from '@/types';
import {
  saveExperiment,
  getExperiment,
  getAllExperiments,
  deleteExperiment as dbDeleteExperiment,
  defaultFittingParams,
  defaultEnvironmentParams,
  saveParamsToLocal,
} from '@/utils/storage';
import { performFitting, calculateEfficiency, generateId } from '@/utils/math';
import { detectAllAnomalies } from '@/utils/anomaly';
import { createSampleExperiment, createEmptyExperiment } from '@/data/sampleData';

interface ExperimentStore {
  experiments: Experiment[];
  currentExperimentId: string | null;
  filterConditions: FilterConditions;
  isLoading: boolean;
  error: string | null;

  loadExperiments: () => Promise<void>;
  loadExperiment: (id: string) => Promise<void>;
  setCurrentExperiment: (id: string | null) => void;
  createNewExperiment: () => Promise<string>;
  createExperimentWithSampleData: () => Promise<string>;
  updateExperiment: (updates: Partial<Experiment>) => void;
  deleteExperiment: (id: string) => Promise<void>;
  saveCurrentExperiment: () => Promise<void>;

  addDataPoint: (point: Omit<DataPoint, 'id'>) => void;
  updateDataPoint: (id: string, updates: Partial<DataPoint>) => void;
  deleteDataPoint: (id: string) => void;
  bulkAddDataPoints: (points: Omit<DataPoint, 'id'>[]) => void;

  updateFittingParams: (params: Partial<FittingParams>) => void;
  updateEnvironmentParams: (params: Partial<EnvironmentParams>) => void;

  updateFilterConditions: (conditions: Partial<FilterConditions>) => void;

  runAnalysis: () => void;
  runFitting: () => void;
  runEfficiencyCalculation: () => void;
  runAnomalyDetection: () => void;

  toggleExcludeDataPoint: (id: string) => void;
  updateAnomalyInclusion: (anomalyId: string, include: boolean) => void;

  getCurrentExperiment: () => Experiment | null;
  getFilteredDataPoints: () => DataPoint[];
}

export const useExperimentStore = create<ExperimentStore>((set, get) => ({
  experiments: [],
  currentExperimentId: null,
  filterConditions: {
    excludeAnomalies: false,
  },
  isLoading: false,
  error: null,

  loadExperiments: async () => {
    set({ isLoading: true });
    try {
      const experiments = await getAllExperiments();
      set({ experiments, isLoading: false });
    } catch (error) {
      set({ error: '加载实验列表失败', isLoading: false });
    }
  },

  loadExperiment: async (id: string) => {
    set({ isLoading: true });
    try {
      const experiment = await getExperiment(id);
      if (experiment) {
        set((state) => ({
          experiments: state.experiments.some(e => e.id === id)
            ? state.experiments.map(e => e.id === id ? experiment : e)
            : [...state.experiments, experiment],
          currentExperimentId: id,
          isLoading: false,
        }));
      }
    } catch (error) {
      set({ error: '加载实验数据失败', isLoading: false });
    }
  },

  setCurrentExperiment: (id) => set({ currentExperimentId: id }),

  createNewExperiment: async () => {
    const experiment = createEmptyExperiment();
    const id = await saveExperiment(experiment);
    set((state) => ({
      experiments: [experiment, ...state.experiments],
      currentExperimentId: id,
    }));
    return id;
  },

  createExperimentWithSampleData: async () => {
    const experiment = createSampleExperiment();
    const id = await saveExperiment(experiment);

    const store = get();
    const anomalies = detectAllAnomalies(experiment.dataPoints, experiment.fittingParams);
    const fittingResult = performFitting(experiment.dataPoints, experiment.fittingParams, experiment.fittingParams.independentVariable);
    const efficiencyResult = calculateEfficiency(experiment.dataPoints, experiment.environment.airDensity, experiment.fittingParams.thrustUnit);

    experiment.anomalies = anomalies;
    experiment.fittingResult = fittingResult;
    experiment.efficiencyResult = efficiencyResult;

    await saveExperiment(experiment);

    set({
      experiments: [experiment, ...store.experiments],
      currentExperimentId: id,
    });
    return id;
  },

  updateExperiment: (updates) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId ? { ...e, ...updates, updatedAt: Date.now() } : e
      ),
    });
  },

  deleteExperiment: async (id) => {
    await dbDeleteExperiment(id);
    set((state) => ({
      experiments: state.experiments.filter(e => e.id !== id),
      currentExperimentId: state.currentExperimentId === id ? null : state.currentExperimentId,
    }));
  },

  saveCurrentExperiment: async () => {
    const exp = get().getCurrentExperiment();
    if (exp) {
      await saveExperiment(exp);
      await saveParamsToLocal(exp.fittingParams, exp.environment);
    }
  },

  addDataPoint: (point) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    const newPoint: DataPoint = {
      ...point,
      id: generateId(),
    };

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? { ...e, dataPoints: [...e.dataPoints, newPoint], updatedAt: Date.now() }
          : e
      ),
    });
  },

  updateDataPoint: (id, updates) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? {
            ...e,
            dataPoints: e.dataPoints.map(p => p.id === id ? { ...p, ...updates } : p),
            updatedAt: Date.now(),
          }
          : e
      ),
    });
  },

  deleteDataPoint: (id) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? {
            ...e,
            dataPoints: e.dataPoints.filter(p => p.id !== id),
            updatedAt: Date.now(),
          }
          : e
      ),
    });
  },

  bulkAddDataPoints: (points) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    const newPoints: DataPoint[] = points.map(p => ({
      ...p,
      id: generateId(),
    }));

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? { ...e, dataPoints: [...e.dataPoints, ...newPoints], updatedAt: Date.now() }
          : e
      ),
    });
  },

  updateFittingParams: (params) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? {
            ...e,
            fittingParams: { ...e.fittingParams, ...params },
            updatedAt: Date.now(),
          }
          : e
      ),
    });
  },

  updateEnvironmentParams: (params) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? {
            ...e,
            environment: { ...e.environment, ...params },
            updatedAt: Date.now(),
          }
          : e
      ),
    });
  },

  updateFilterConditions: (conditions) => {
    set((state) => ({
      filterConditions: { ...state.filterConditions, ...conditions },
    }));
  },

  runAnalysis: () => {
    get().runAnomalyDetection();
    get().runFitting();
    get().runEfficiencyCalculation();
  },

  runFitting: () => {
    const exp = get().getCurrentExperiment();
    if (!exp) return;

    const filteredPoints = get().getFilteredDataPoints();
    const fittingResult = performFitting(
      filteredPoints,
      exp.fittingParams,
      exp.fittingParams.independentVariable
    );

    get().updateExperiment({ fittingResult });
  },

  runEfficiencyCalculation: () => {
    const exp = get().getCurrentExperiment();
    if (!exp) return;

    const filteredPoints = get().getFilteredDataPoints();
    const efficiencyResult = calculateEfficiency(
      filteredPoints,
      exp.environment.airDensity,
      exp.fittingParams.thrustUnit
    );

    get().updateExperiment({ efficiencyResult });
  },

  runAnomalyDetection: () => {
    const exp = get().getCurrentExperiment();
    if (!exp) return;

    const anomalies = detectAllAnomalies(exp.dataPoints, exp.fittingParams);
    get().updateExperiment({ anomalies });
  },

  toggleExcludeDataPoint: (id) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? {
            ...e,
            dataPoints: e.dataPoints.map(p =>
              p.id === id ? { ...p, isExcluded: !p.isExcluded } : p
            ),
            updatedAt: Date.now(),
          }
          : e
      ),
    });
  },

  updateAnomalyInclusion: (anomalyId, include) => {
    const { currentExperimentId, experiments } = get();
    if (!currentExperimentId) return;

    set({
      experiments: experiments.map(e =>
        e.id === currentExperimentId
          ? {
            ...e,
            anomalies: e.anomalies.map(a =>
              a.id === anomalyId ? { ...a, isIncludedInReport: include } : a
            ),
            updatedAt: Date.now(),
          }
          : e
      ),
    });
  },

  getCurrentExperiment: () => {
    const { experiments, currentExperimentId } = get();
    return experiments.find(e => e.id === currentExperimentId) || null;
  },

  getFilteredDataPoints: () => {
    const exp = get().getCurrentExperiment();
    const { filterConditions } = get();
    if (!exp) return [];

    let points = exp.dataPoints.filter(p => !p.isExcluded);

    if (filterConditions.rpmRange) {
      points = points.filter(p => p.rpm >= filterConditions.rpmRange![0] && p.rpm <= filterConditions.rpmRange![1]);
    }
    if (filterConditions.voltageRange) {
      points = points.filter(p => p.voltage >= filterConditions.voltageRange![0] && p.voltage <= filterConditions.voltageRange![1]);
    }
    if (filterConditions.propellerDiameter) {
      points = points.filter(p => p.propellerDiameter === filterConditions.propellerDiameter);
    }
    if (filterConditions.excludeAnomalies) {
      const anomalyPointIds = new Set(exp.anomalies.map(a => a.dataPointId));
      points = points.filter(p => !anomalyPointIds.has(p.id));
    }

    return points;
  },
}));
