import { create } from 'zustand';
import type {
  AppState,
  WeeklyRecord,
  ProductStatus,
  ConfirmationStatus,
  TransitionMatrix,
  ForecastResult,
  AbsorbingAnalysis,
  AnomalyRecord,
  ReportBatch,
  MatrixType,
} from '@/types';
import { PRODUCT_STATUSES } from '@/types';
import { weeklyRecords as mockRecords, getRecordsByStatusTransition } from '@/utils/mockData';
import {
  calculateTransitionMatrix,
  forecastStates,
  analyzeAbsorbingStates,
} from '@/utils/markovChain';
import { detectAllAnomalies } from '@/utils/anomalyDetection';
import { exportReport } from '@/utils/reportExport';
import type { ContentType, ReportFormat } from '@/types';

function getCurrentStateDistribution(records: WeeklyRecord[]): Record<ProductStatus, number> {
  const latestWeek = Math.max(...records.map(r => r.weekNum));
  const latestRecords = records.filter(r => r.weekNum === latestWeek);

  const counts: Record<ProductStatus, number> = {
    NEW: 0, HOT: 0, NORMAL: 0, SLOW: 0, CLEAR: 0,
  };

  latestRecords.forEach(r => {
    counts[r.status]++;
  });

  return counts;
}

interface AppActions {
  initializeData: () => void;
  recalculateMatrix: () => void;
  setConfirmationFilter: (filter: ConfirmationStatus | 'ALL') => void;
  setForecastWeeks: (weeks: number) => void;
  setWindowSize: (size: number) => void;
  setSelectedCell: (cell: { from: ProductStatus; to: ProductStatus } | null) => void;
  updateRecordConfirmation: (recordId: string, status: ConfirmationStatus, notes?: string) => void;
  resolveAnomaly: (anomalyId: string) => void;
  generateReport: (format: ReportFormat, contentType: ContentType) => ReportBatch | null;
  calculateAll: () => void;
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  weeklyRecords: [],
  transitionMatrix: null,
  promoMatrix: null,
  nonPromoMatrix: null,
  forecastResults: [],
  absorbingAnalysis: null,
  anomalies: [],
  reportBatches: [],
  selectedCell: null,
  drillDownRecords: [],
  confirmationFilter: 'ALL',
  forecastWeeks: 8,
  windowSize: 1,
  isLoading: true,

  initializeData: () => {
    set({ weeklyRecords: mockRecords, isLoading: false });
    get().calculateAll();
  },

  calculateAll: () => {
    const { weeklyRecords, confirmationFilter, windowSize, forecastWeeks } = get();

    if (weeklyRecords.length === 0) return;

    set({ isLoading: true });

    const fullMatrix = calculateTransitionMatrix(
      weeklyRecords, windowSize, confirmationFilter, null, 'FULL'
    );

    const promoMatrix = calculateTransitionMatrix(
      weeklyRecords, windowSize, confirmationFilter, true, 'PROMO'
    );

    const nonPromoMatrix = calculateTransitionMatrix(
      weeklyRecords, windowSize, confirmationFilter, false, 'NON_PROMO'
    );

    const initialState = getCurrentStateDistribution(weeklyRecords);
    const forecast = forecastStates(fullMatrix, initialState, forecastWeeks);
    const absorbing = analyzeAbsorbingStates(fullMatrix);
    const anomalies = detectAllAnomalies(fullMatrix, promoMatrix, nonPromoMatrix);

    set({
      transitionMatrix: fullMatrix,
      promoMatrix,
      nonPromoMatrix,
      forecastResults: forecast,
      absorbingAnalysis: absorbing,
      anomalies,
      isLoading: false,
    });
  },

  recalculateMatrix: () => {
    get().calculateAll();
  },

  setConfirmationFilter: (filter) => {
    set({ confirmationFilter: filter });
    get().calculateAll();
  },

  setForecastWeeks: (weeks) => {
    set({ forecastWeeks: weeks });
    const { transitionMatrix, weeklyRecords } = get();
    if (transitionMatrix) {
      const initialState = getCurrentStateDistribution(weeklyRecords);
      const forecast = forecastStates(transitionMatrix, initialState, weeks);
      set({ forecastResults: forecast });
    }
  },

  setWindowSize: (size) => {
    set({ windowSize: size });
    get().calculateAll();
  },

  setSelectedCell: (cell) => {
    if (!cell) {
      set({ selectedCell: null, drillDownRecords: [] });
      return;
    }

    const { weeklyRecords } = get();
    const drillRecords = getRecordsByStatusTransition(weeklyRecords, cell.from, cell.to);
    set({ selectedCell: cell, drillDownRecords: drillRecords });
  },

  updateRecordConfirmation: (recordId, status, notes) => {
    const { weeklyRecords } = get();
    const updated = weeklyRecords.map(r =>
      r.id === recordId ? { ...r, confirmationStatus: status, notes } : r
    );
    set({ weeklyRecords: updated });
    get().calculateAll();
  },

  resolveAnomaly: (anomalyId) => {
    const { anomalies } = get();
    const updated = anomalies.map(a =>
      a.id === anomalyId ? { ...a, isResolved: true } : a
    );
    set({ anomalies: updated });
  },

  generateReport: (format, contentType) => {
    const { transitionMatrix, forecastResults, anomalies, weeklyRecords, reportBatches } = get();
    const batch = exportReport(format, contentType, transitionMatrix, forecastResults, anomalies, weeklyRecords);

    if (batch) {
      set({ reportBatches: [batch, ...reportBatches] });
    }

    return batch;
  },
}));
