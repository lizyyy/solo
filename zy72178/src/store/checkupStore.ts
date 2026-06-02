import { create } from 'zustand';
import { getAllFromStore, getFromStore, getFromIndex } from '../db';
import {
  createCheckupRun as createCheckupRunService,
  addManualJudgment as addManualJudgmentService,
  addNote as addNoteService,
  getCheckupRunWithResults,
} from '../services/checkupEngine';
import type {
  CheckupRun,
  SampleResult,
  ModelVersion,
  JudgmentType,
  CreateCheckupOptions,
} from '../types';

interface CheckupState {
  runs: CheckupRun[];
  currentRun: CheckupRun | null;
  currentResults: SampleResult[];
  results: SampleResult[];
  currentModelVersion: ModelVersion | null;
  loading: boolean;
  error: string | null;
  fetchRuns: () => Promise<void>;
  fetchResults: (runId: string) => Promise<void>;
  createRun: (options: CreateCheckupOptions) => Promise<CheckupRun>;
  loadRun: (runId: string) => Promise<void>;
  addManualJudgment: (
    sampleResultId: string,
    newJudgment: JudgmentType,
    reason: string
  ) => Promise<void>;
  addNote: (
    entityType: 'checkup_run' | 'sample_result',
    entityId: string,
    content: string,
    diffSummary?: string
  ) => Promise<void>;
  clearCurrent: () => void;
}

export const useCheckupStore = create<CheckupState>((set, get) => ({
  runs: [],
  currentRun: null,
  currentResults: [],
  results: [],
  currentModelVersion: null,
  loading: false,
  error: null,
  fetchRuns: async () => {
    set({ loading: true, error: null });
    try {
      const runs = await getAllFromStore('checkupRuns', 'by-createdAt', 'prev');
      set({ runs, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  fetchResults: async (runId: string) => {
    set({ loading: true, error: null });
    try {
      const results = await getFromIndex('sampleResults', 'by-checkupRunId', runId);
      set({ results, currentResults: results, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  createRun: async (options) => {
    set({ loading: true, error: null });
    try {
      const run = await createCheckupRunService(options);
      await get().fetchRuns();
      return run;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  loadRun: async (runId) => {
    set({ loading: true, error: null });
    try {
      const data = await getCheckupRunWithResults(runId);
      if (data) {
        set({
          currentRun: data.run,
          currentResults: data.results,
          currentModelVersion: data.modelVersion,
          loading: false,
        });
      } else {
        set({ error: '体检记录不存在', loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  addManualJudgment: async (sampleResultId, newJudgment, reason) => {
    set({ loading: true, error: null });
    try {
      await addManualJudgmentService(sampleResultId, newJudgment, reason);
      if (get().currentRun) {
        await get().loadRun(get().currentRun.id);
      }
      await get().fetchRuns();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  addNote: async (entityType, entityId, content, diffSummary) => {
    set({ loading: true, error: null });
    try {
      await addNoteService(entityType, entityId, content, diffSummary);
      if (entityType === 'sample_result' && get().currentRun) {
        await get().loadRun(get().currentRun.id);
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  clearCurrent: () => set({
    currentRun: null,
    currentResults: [],
    currentModelVersion: null,
  }),
}));
