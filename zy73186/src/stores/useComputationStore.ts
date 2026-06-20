import { create } from 'zustand';
import type { ComputationStep } from '../types';
import { persistenceService } from '../services/persistence';
import { errorPropagationEngine, generateErrorPropagationSteps } from '../services/errorPropagation';
import { auditLogger } from '../services/auditLogger';

interface ComputationState {
  steps: ComputationStep[];
  isLoading: boolean;
  error: string | null;
  expandedSteps: string[];
  compareSteps: { left: ComputationStep[] | null; right: ComputationStep[] | null } | null;

  loadSteps: (sessionId: string) => Promise<void>;
  computeErrorPropagation: (
    sessionId: string,
    formula: string,
    variables: Array<{
      name: string;
      value: number;
      unit: string;
      error: number;
      targetUnit?: string;
    }>,
    resultUnit: string,
    description: string,
    operator?: string
  ) => Promise<ComputationStep[]>;
  updateStepResult: (
    stepId: string,
    newResult: number,
    reason: string,
    operator?: string
  ) => Promise<void>;
  toggleStepExpand: (stepId: string) => void;
  toggleStep: (stepId: string) => void;
  setCompareMode: (
    leftSteps: ComputationStep[] | null,
    rightSteps: ComputationStep[] | null
  ) => void;
  clearCompareMode: () => void;
  clearSteps: () => void;
  clearError: () => void;
}

export const useComputationStore = create<ComputationState>((set, get) => ({
  steps: [],
  isLoading: false,
  error: null,
  expandedSteps: [],
  compareSteps: null,

  loadSteps: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const steps = await persistenceService.getComputationStepsBySession(sessionId);
      set({ steps, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  computeErrorPropagation: async (
    sessionId,
    formula,
    variables,
    resultUnit,
    description,
    operator
  ) => {
    set({ isLoading: true, error: null });
    try {
      const steps = generateErrorPropagationSteps(
        sessionId,
        formula,
        variables,
        resultUnit,
        description
      );

      for (const step of steps) {
        await persistenceService.saveComputationStep(step);

        if (step.stepOrder > 1) {
          const log = auditLogger.logCompute(
            sessionId,
            step.id,
            step.formula,
            step.result,
            operator
          );
          await persistenceService.saveAuditLog(log);
        }
      }

      set((state) => ({
        steps: [...state.steps, ...steps],
        isLoading: false,
      }));

      return steps;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateStepResult: async (stepId, newResult, reason, operator) => {
    const { steps } = get();
    const stepIndex = steps.findIndex((s) => s.id === stepId);

    if (stepIndex === -1) {
      set({ error: '计算步骤不存在' });
      return;
    }

    const step = steps[stepIndex];
    const beforeValue = step.result;

    if (beforeValue === newResult) {
      return;
    }

    const updatedStep: ComputationStep = {
      ...step,
      result: newResult,
      manuallyModified: true,
      updatedAt: Date.now(),
    };

    set({ isLoading: true, error: null });
    try {
      await persistenceService.saveComputationStep(updatedStep);

      const log = auditLogger.logManualEdit(
        step.sessionId,
        stepId,
        beforeValue,
        newResult,
        reason,
        operator
      );
      await persistenceService.saveAuditLog(log);

      set((state) => ({
        steps: state.steps.map((s, i) =>
          i === stepIndex ? updatedStep : s
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  toggleStepExpand: (stepId) => {
    set((state) => {
      const isExpanded = state.expandedSteps.includes(stepId);
      return {
        expandedSteps: isExpanded
          ? state.expandedSteps.filter((id) => id !== stepId)
          : [...state.expandedSteps, stepId],
      };
    });
  },

  toggleStep: (stepId) => {
    get().toggleStepExpand(stepId);
  },

  setCompareMode: (leftSteps, rightSteps) => {
    set({ compareSteps: { left: leftSteps, right: rightSteps } });
  },

  clearCompareMode: () => {
    set({ compareSteps: null });
  },

  clearSteps: () => set({ steps: [], expandedSteps: [] }),

  clearError: () => set({ error: null }),
}));
