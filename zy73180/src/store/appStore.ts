import { create } from 'zustand';
import type {
  HistoricalAnswer,
  FieldMapping,
  CalculationRun,
  CalculationParams,
  AnomalyRecord,
  AnomalyFilter,
  ComparisonResult,
  ProcessingStatus,
  AnomalyType,
} from '@/types';
import { detectAnomalies, updateAnomalyStatus } from '@/engine/anomalyDetector';
import { compareRuns } from '@/engine/comparator';
import { createHistoricalAnswers, defaultFieldMappings, defaultCalculationParams, adjustedCalculationParams } from '@/data/sampleData';

interface AppState {
  answers: HistoricalAnswer[];
  mappings: FieldMapping[];
  params: CalculationParams;
  currentRun: CalculationRun | null;
  previousRun: CalculationRun | null;
  comparison: ComparisonResult | null;
  selectedAnomalyId: string | null;
  filter: AnomalyFilter;

  initDefault: () => void;
  runCalculation: (name: string, params?: CalculationParams) => void;
  updateAnomalyStatus: (anomalyId: string, status: ProcessingStatus) => void;
  selectAnomaly: (anomalyId: string | null) => void;
  setFilter: (filter: Partial<AnomalyFilter>) => void;
  toggleFilterType: (type: AnomalyType) => void;
  toggleFilterStatus: (status: ProcessingStatus) => void;
  resetFilter: () => void;
  updateParams: (params: Partial<CalculationParams>) => void;
  addMapping: (mapping: FieldMapping) => void;
  addAnswers: (answers: HistoricalAnswer[]) => void;
}

const defaultFilter: AnomalyFilter = {
  types: [],
  statuses: [],
  sources: [],
  searchKeyword: '',
};

export const useAppStore = create<AppState>((set, get) => ({
  answers: [],
  mappings: [],
  params: defaultCalculationParams,
  currentRun: null,
  previousRun: null,
  comparison: null,
  selectedAnomalyId: null,
  filter: defaultFilter,

  initDefault: () => {
    const state = get();
    
    if (state.answers.length > 0 && state.mappings.length > 0) {
      if (state.currentRun) {
        return;
      }
      
      const run = detectAnomalies(state.answers, state.mappings, state.params, '初始验算');
      set({
        currentRun: run,
        previousRun: null,
        comparison: null,
        selectedAnomalyId: null,
        filter: { ...defaultFilter },
      });
      return;
    }
    
    const answers = createHistoricalAnswers();
    const mappings = defaultFieldMappings;
    const params = defaultCalculationParams;

    const run = detectAnomalies(answers, mappings, params, '初始验算');

    set({
      answers,
      mappings,
      params,
      currentRun: run,
      previousRun: null,
      comparison: null,
      selectedAnomalyId: null,
      filter: { ...defaultFilter },
    });
  },

  runCalculation: (name, params) => {
    const state = get();
    const useParams = params || state.params;

    const previousRun = state.currentRun;
    const newRun = detectAnomalies(state.answers, state.mappings, useParams, name);

    let comparison: ComparisonResult | null = null;
    if (previousRun) {
      comparison = compareRuns(previousRun, newRun);
    }

    set({
      params: useParams,
      previousRun,
      currentRun: newRun,
      comparison,
      selectedAnomalyId: null,
    });
  },

  updateAnomalyStatus: (anomalyId, status) => {
    const state = get();
    if (!state.currentRun) return;

    const updatedRun = updateAnomalyStatus(state.currentRun, anomalyId, status);

    let comparison = state.comparison;
    if (state.previousRun) {
      comparison = compareRuns(state.previousRun, updatedRun);
    }

    set({ currentRun: updatedRun, comparison });
  },

  selectAnomaly: (anomalyId) => {
    set({ selectedAnomalyId: anomalyId });
  },

  setFilter: (partial) => {
    const state = get();
    set({ filter: { ...state.filter, ...partial } });
  },

  toggleFilterType: (type) => {
    const state = get();
    const types = state.filter.types.includes(type)
      ? state.filter.types.filter(t => t !== type)
      : [...state.filter.types, type];
    set({ filter: { ...state.filter, types } });
  },

  toggleFilterStatus: (status) => {
    const state = get();
    const statuses = state.filter.statuses.includes(status)
      ? state.filter.statuses.filter(s => s !== status)
      : [...state.filter.statuses, status];
    set({ filter: { ...state.filter, statuses } });
  },

  resetFilter: () => {
    set({ filter: { ...defaultFilter } });
  },

  updateParams: (partial) => {
    const state = get();
    set({ params: { ...state.params, ...partial } });
  },

  addMapping: (mapping) => {
    const state = get();
    set({ mappings: [...state.mappings, mapping] });
  },

  addAnswers: (answers) => {
    const state = get();
    set({ answers: [...state.answers, ...answers] });
  },
}));

export { adjustedCalculationParams };
