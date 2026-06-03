import { create } from 'zustand';
import type { CanonicalResult, AnnotationRow } from '../types';
import {
  getLatestCanonicalResult,
  triggerRecalculation,
  generateCanonicalResult,
} from '../services/recalculationService';
import { importCoordinateOrigin, type ImportResult } from '../services/importService';
import {
  supplementPhotoNumber,
  reviewMissingRow,
  fixMissingRow,
  updateOcclusionList,
} from '../services/traceService';
import { downloadExport, runSelfCheck, getLatestSelfCheckResults } from '../services/consistencyService';
import type { SelfCheckType, SelfCheckResult, WorkflowState } from '../types';

interface CanonicalStore {
  currentOperator: '许工' | '安全员';
  setOperator: (op: '许工' | '安全员') => void;

  canonicalResult: CanonicalResult | null;
  isLoading: boolean;
  error: string | null;

  loadCanonicalResult: () => Promise<void>;
  importData: (content: string, fileName: string) => Promise<ImportResult>;
  recalculate: () => Promise<{ success: boolean; newVersion: string }>;
  supplementPhoto: (rowId: string, photoNumber: string) => Promise<boolean>;
  reviewMissing: (rowId: string, comment: string) => Promise<boolean>;
  fixMissing: (rowId: string, x: number, y: number, z: number) => Promise<boolean>;
  updateOcclusion: (photoPointIds: string[], isOccluded: boolean) => Promise<boolean>;
  exportFile: (format: 'xlsx' | 'csv', fileName: string) => Promise<void>;

  selfCheckResults: Record<SelfCheckType, SelfCheckResult | null>;
  runSelfCheck: (type: SelfCheckType) => Promise<SelfCheckResult>;
  loadSelfCheckResults: () => Promise<void>;

  workflowState: WorkflowState;
  updateWorkflowStep: (step: Partial<WorkflowState>) => void;
  initWorkflow: () => Promise<void>;
}

const initialWorkflowState: WorkflowState = {
  currentStep: 'step1_import',
  step1Completed: false,
  step2Completed: false,
  step3Completed: false,
  hasMissingRow: false,
  missingRowReviewed: false,
  startedAt: Date.now(),
  lastUpdatedAt: Date.now(),
};

export const useCanonicalStore = create<CanonicalStore>((set, get) => ({
  currentOperator: '许工',
  setOperator: (op) => set({ currentOperator: op }),

  canonicalResult: null,
  isLoading: false,
  error: null,

  loadCanonicalResult: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getLatestCanonicalResult();
      set({ canonicalResult: result, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  importData: async (content: string, fileName: string) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await importCoordinateOrigin(content, fileName, currentOperator);

      if (result.success) {
        await generateCanonicalResult(currentOperator);
        await get().loadCanonicalResult();

        const state = get().workflowState;
        get().updateWorkflowStep({
          ...state,
          step1Completed: true,
          currentStep: result.missingRows.length > 0 ? 'step1_import' : 'step2_photo',
          hasMissingRow: result.missingRows.length > 0,
          lastUpdatedAt: Date.now(),
        });
      }

      set({ isLoading: false });
      return result;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  recalculate: async () => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await triggerRecalculation(currentOperator);
      await get().loadCanonicalResult();

      const state = get().workflowState;
      if (result.success) {
        get().updateWorkflowStep({
          ...state,
          step3Completed: true,
          currentStep: 'completed',
          lastUpdatedAt: Date.now(),
        });
      }

      set({ isLoading: false });
      return { success: result.success, newVersion: result.newVersion };
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  supplementPhoto: async (rowId: string, photoNumber: string) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await supplementPhotoNumber(rowId, photoNumber, currentOperator);

      if (result.success) {
        await generateCanonicalResult(currentOperator);
        await get().loadCanonicalResult();

        const state = get().workflowState;
        get().updateWorkflowStep({
          ...state,
          step2Completed: true,
          currentStep: 'step3_occlusion',
          lastUpdatedAt: Date.now(),
        });
      }

      set({ isLoading: false });
      return result.success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  reviewMissing: async (rowId: string, comment: string) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await reviewMissingRow(rowId, comment, currentOperator);

      if (result.success) {
        await generateCanonicalResult(currentOperator);
        await get().loadCanonicalResult();

        const state = get().workflowState;
        get().updateWorkflowStep({
          ...state,
          missingRowReviewed: true,
          currentStep: 'step2_photo',
          lastUpdatedAt: Date.now(),
        });
      }

      set({ isLoading: false });
      return result.success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  fixMissing: async (rowId: string, x: number, y: number, z: number) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await fixMissingRow(rowId, x, y, z, currentOperator);

      if (result.success) {
        await generateCanonicalResult(currentOperator);
        await get().loadCanonicalResult();
      }

      set({ isLoading: false });
      return result.success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateOcclusion: async (photoPointIds: string[], isOccluded: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await updateOcclusionList(photoPointIds, isOccluded, currentOperator);

      if (result.success) {
        await generateCanonicalResult(currentOperator);
        await get().loadCanonicalResult();
      }

      set({ isLoading: false });
      return result.success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  exportFile: async (format: 'xlsx' | 'csv', fileName: string) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      await downloadExport(format, currentOperator, fileName);
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  selfCheckResults: {
    duplicate_import: null,
    missing_row: null,
    recalculation: null,
    export_consistency: null,
  },

  runSelfCheck: async (type: SelfCheckType) => {
    set({ isLoading: true, error: null });
    try {
      const { currentOperator } = get();
      const result = await runSelfCheck(type, currentOperator);
      set(state => ({
        selfCheckResults: { ...state.selfCheckResults, [type]: result },
        isLoading: false,
      }));
      return result;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  loadSelfCheckResults: async () => {
    set({ isLoading: true, error: null });
    try {
      const results = await getLatestSelfCheckResults();
      set({ selfCheckResults: results, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  workflowState: initialWorkflowState,

  updateWorkflowStep: (updates: Partial<WorkflowState>) => {
    set(state => ({
      workflowState: { ...state.workflowState, ...updates },
    }));
  },

  initWorkflow: async () => {
    const result = await getLatestCanonicalResult();
    if (result) {
      await get().loadCanonicalResult();
    }
    await get().loadSelfCheckResults();
  },
}));

export function useAnnotationRows(): AnnotationRow[] {
  return useCanonicalStore(state => state.canonicalResult?.rows || []);
}

export function useMissingRows(): AnnotationRow[] {
  return useAnnotationRows().filter(r => r.status === 'missing_row');
}

export function useSingleDataSourceVersion(): string {
  return useCanonicalStore(state => state.canonicalResult?.version || '');
}
