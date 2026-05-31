import { create } from 'zustand';
import type { Experiment, StepRecord, ScoreSheet, ScriptVersion, Anomaly } from '@/types';
import { mockExperiments, mockStepRecords, mockScoreSheets, mockScriptVersions, mockAnomalies } from '@/data/mockData';

interface ExperimentState {
  experiments: Experiment[];
  stepRecords: StepRecord[];
  scoreSheets: ScoreSheet[];
  scriptVersions: ScriptVersion[];
  anomalies: Anomaly[];
  selectedExperimentId: string | null;
  filters: {
    className: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  };
  setSelectedExperimentId: (id: string | null) => void;
  setFilters: (filters: Partial<ExperimentState['filters']>) => void;
  getExperimentById: (id: string) => Experiment | undefined;
  getStepRecordsByExperimentId: (id: string) => StepRecord[];
  getScoreSheetByExperimentId: (id: string) => ScoreSheet | undefined;
  getScriptVersionsByExperimentId: (id: string) => ScriptVersion[];
  getAnomaliesByExperimentId: (id: string) => Anomaly[];
  getFilteredExperiments: () => Experiment[];
  resolveAnomaly: (anomalyId: string) => void;
}

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  experiments: mockExperiments,
  stepRecords: mockStepRecords,
  scoreSheets: mockScoreSheets,
  scriptVersions: mockScriptVersions,
  anomalies: mockAnomalies,
  selectedExperimentId: null,
  filters: {
    className: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  },
  setSelectedExperimentId: (id) => set({ selectedExperimentId: id }),
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  getExperimentById: (id) => get().experiments.find((e) => e.id === id),
  getStepRecordsByExperimentId: (id) =>
    get()
      .stepRecords.filter((s) => s.experimentId === id)
      .sort((a, b) => a.stepNumber - b.stepNumber),
  getScoreSheetByExperimentId: (id) => get().scoreSheets.find((s) => s.experimentId === id),
  getScriptVersionsByExperimentId: (id) =>
    get()
      .scriptVersions.filter((s) => s.experimentId === id)
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()),
  getAnomaliesByExperimentId: (id) =>
    get()
      .anomalies.filter((a) => a.experimentId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  getFilteredExperiments: () => {
    const { experiments, filters } = get();
    return experiments.filter((exp) => {
      if (filters.className && !exp.className.includes(filters.className)) return false;
      if (filters.status && exp.status !== filters.status) return false;
      if (filters.dateFrom && exp.experimentDate < filters.dateFrom) return false;
      if (filters.dateTo && exp.experimentDate > filters.dateTo) return false;
      return true;
    });
  },
  resolveAnomaly: (anomalyId) =>
    set((state) => ({
      anomalies: state.anomalies.map((a) =>
        a.id === anomalyId ? { ...a, resolved: true } : a
      ),
    })),
}));
