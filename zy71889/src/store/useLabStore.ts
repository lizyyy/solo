import { create } from 'zustand';
import type {
  ExperimentBatch,
  TimelineEvent,
  ViscosityEstimate,
  GradingSheet,
  CreateCorrectionRequest,
  CreateConfirmationRequest,
  CreateBatchRequest,
} from '@shared/types';
import { api } from '@/lib/api';

interface LabState {
  batches: ExperimentBatch[];
  currentBatch: ExperimentBatch | null;
  timeline: TimelineEvent[];
  viscosityHistory: ViscosityEstimate[];
  gradingSheet: GradingSheet | null;
  batchVersions: ExperimentBatch[];
  loading: {
    batches: boolean;
    batch: boolean;
    timeline: boolean;
    viscosity: boolean;
    grading: boolean;
    versions: boolean;
  };
  error: string | null;
  fetchBatches: () => Promise<void>;
  fetchBatch: (id: string) => Promise<void>;
  fetchTimeline: (batchId: string) => Promise<void>;
  fetchViscosityHistory: (batchId: string) => Promise<void>;
  runViscosityEstimate: (batchId: string) => Promise<void>;
  fetchGradingSheet: (batchId: string) => Promise<void>;
  generateGradingSheet: (batchId: string) => Promise<void>;
  fetchBatchVersions: (batchId: string) => Promise<void>;
  addCorrection: (batchId: string, data: CreateCorrectionRequest) => Promise<void>;
  addConfirmation: (batchId: string, data: CreateConfirmationRequest) => Promise<void>;
  createBatch: (data: CreateBatchRequest) => Promise<{ batch: ExperimentBatch; isDuplicate: boolean } | null>;
  clearError: () => void;
  resetCurrentBatch: () => void;
}

export const useLabStore = create<LabState>((set, get) => ({
  batches: [],
  currentBatch: null,
  timeline: [],
  viscosityHistory: [],
  gradingSheet: null,
  batchVersions: [],
  loading: {
    batches: false,
    batch: false,
    timeline: false,
    viscosity: false,
    grading: false,
    versions: false,
  },
  error: null,

  fetchBatches: async () => {
    set({ loading: { ...get().loading, batches: true }, error: null });
    try {
      const batches = await api.getBatches();
      set({ batches, loading: { ...get().loading, batches: false } });
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, batches: false },
      });
    }
  },

  fetchBatch: async (id: string) => {
    set({ loading: { ...get().loading, batch: true }, error: null });
    try {
      const batch = await api.getBatch(id);
      set({ currentBatch: batch, loading: { ...get().loading, batch: false } });
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, batch: false },
      });
    }
  },

  fetchTimeline: async (batchId: string) => {
    set({ loading: { ...get().loading, timeline: true }, error: null });
    try {
      const timeline = await api.getTimeline(batchId);
      set({ timeline, loading: { ...get().loading, timeline: false } });
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, timeline: false },
      });
    }
  },

  fetchViscosityHistory: async (batchId: string) => {
    set({ loading: { ...get().loading, viscosity: true }, error: null });
    try {
      const history = await api.getViscosityHistory(batchId);
      set({ viscosityHistory: history, loading: { ...get().loading, viscosity: false } });
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, viscosity: false },
      });
    }
  },

  runViscosityEstimate: async (batchId: string) => {
    set({ loading: { ...get().loading, viscosity: true }, error: null });
    try {
      const estimate = await api.runViscosityEstimate(batchId);
      const history = [...get().viscosityHistory, estimate];
      set({
        viscosityHistory: history,
        loading: { ...get().loading, viscosity: false },
      });
      await get().fetchBatch(batchId);
      await get().fetchTimeline(batchId);
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, viscosity: false },
      });
    }
  },

  fetchGradingSheet: async (batchId: string) => {
    set({ loading: { ...get().loading, grading: true }, error: null });
    try {
      const sheet = await api.getGradingSheet(batchId);
      set({ gradingSheet: sheet, loading: { ...get().loading, grading: false } });
    } catch (err) {
      set({
        gradingSheet: null,
        loading: { ...get().loading, grading: false },
      });
    }
  },

  generateGradingSheet: async (batchId: string) => {
    set({ loading: { ...get().loading, grading: true }, error: null });
    try {
      const sheet = await api.generateGradingSheet(batchId);
      set({ gradingSheet: sheet, loading: { ...get().loading, grading: false } });
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, grading: false },
      });
    }
  },

  fetchBatchVersions: async (batchId: string) => {
    set({ loading: { ...get().loading, versions: true }, error: null });
    try {
      const versions = await api.getBatchVersions(batchId);
      set({ batchVersions: versions, loading: { ...get().loading, versions: false } });
    } catch (err) {
      set({
        error: (err as Error).message,
        loading: { ...get().loading, versions: false },
      });
    }
  },

  addCorrection: async (batchId: string, data: CreateCorrectionRequest) => {
    set({ error: null });
    try {
      await api.addCorrection(batchId, data);
      await get().fetchTimeline(batchId);
      await get().fetchGradingSheet(batchId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  addConfirmation: async (batchId: string, data: CreateConfirmationRequest) => {
    set({ error: null });
    try {
      await api.addConfirmation(batchId, data);
      await get().fetchTimeline(batchId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  createBatch: async (data: CreateBatchRequest) => {
    set({ error: null });
    try {
      const result = await api.createBatch(data);
      await get().fetchBatches();
      return result;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  clearError: () => set({ error: null }),

  resetCurrentBatch: () => {
    set({
      currentBatch: null,
      timeline: [],
      viscosityHistory: [],
      gradingSheet: null,
      batchVersions: [],
    });
  },
}));
