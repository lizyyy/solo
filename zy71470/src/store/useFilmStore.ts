import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FilmParams, CalculationResult, ComparisonGroup, ValidationWarning } from '@/types';
import { defaultParams, ENGINE_VERSION } from '@/data/cieData';
import { calculateFullResult } from '@/utils/interferenceEngine';
import { validateParams } from '@/utils/validation';

interface FilmState {
  params: FilmParams;
  result: CalculationResult | null;
  warnings: ValidationWarning[];
  hasErrors: boolean;
  comparisonGroups: ComparisonGroup[];
  spectrumStep: number;
  isCalculating: boolean;
  setParams: (params: Partial<FilmParams>) => void;
  updateParam: <K extends keyof FilmParams>(key: K, value: FilmParams[K]) => void;
  calculateResult: () => void;
  addComparisonGroup: (name: string) => void;
  removeComparisonGroup: (id: string) => void;
  clearComparisonGroups: () => void;
  setSpectrumStep: (step: number) => void;
  exportResult: () => string;
  loadParams: (params: FilmParams) => void;
  resetToDefault: () => void;
}

const performCalculation = (params: FilmParams, step: number): { result: CalculationResult; warnings: ValidationWarning[]; hasErrors: boolean } => {
  const validation = validateParams(params);
  const result = calculateFullResult(params, step);
  return {
    result,
    warnings: validation.warnings,
    hasErrors: validation.hasErrors,
  };
};

const initialCalculation = performCalculation(defaultParams, 5);

export const useFilmStore = create<FilmState>()(
  persist(
    (set, get) => ({
      params: defaultParams,
      result: initialCalculation.result,
      warnings: initialCalculation.warnings,
      hasErrors: initialCalculation.hasErrors,
      comparisonGroups: [],
      spectrumStep: 5,
      isCalculating: false,

      setParams: (newParams) => {
        const params = { ...get().params, ...newParams };
        const step = get().spectrumStep;
        const { result, warnings, hasErrors } = performCalculation(params, step);
        set({ params, result, warnings, hasErrors });
      },

      updateParam: (key, value) => {
        const params = { ...get().params, [key]: value };
        const step = get().spectrumStep;
        const { result, warnings, hasErrors } = performCalculation(params, step);
        set({ params, result, warnings, hasErrors });
      },

      calculateResult: () => {
        set({ isCalculating: true });
        const { params, spectrumStep } = get();
        const { result, warnings, hasErrors } = performCalculation(params, spectrumStep);
        set({ result, warnings, hasErrors, isCalculating: false });
      },

      addComparisonGroup: (name: string) => {
        const { params, result } = get();
        if (!result) return;

        const newGroup: ComparisonGroup = {
          id: `group-${Date.now()}`,
          name,
          params: JSON.parse(JSON.stringify(params)),
          result: JSON.parse(JSON.stringify(result)),
          createdAt: Date.now(),
        };

        const groups = [...get().comparisonGroups];
        if (groups.length >= 4) {
          groups.shift();
        }
        groups.push(newGroup);
        set({ comparisonGroups: groups });
      },

      removeComparisonGroup: (id: string) => {
        set({
          comparisonGroups: get().comparisonGroups.filter((g) => g.id !== id),
        });
      },

      clearComparisonGroups: () => {
        set({ comparisonGroups: [] });
      },

      setSpectrumStep: (step: number) => {
        set({ spectrumStep: step });
        const { params } = get();
        const { result, warnings, hasErrors } = performCalculation(params, step);
        set({ result, warnings, hasErrors });
      },

      exportResult: () => {
        const { params, result, comparisonGroups } = get();
        const exportData = {
          exportVersion: '1.0',
          engineVersion: ENGINE_VERSION,
          exportedAt: new Date().toISOString(),
          currentParams: params,
          currentResult: result,
          comparisonGroups,
        };
        return JSON.stringify(exportData, null, 2);
      },

      loadParams: (loadedParams: FilmParams) => {
        const step = get().spectrumStep;
        const { result, warnings, hasErrors } = performCalculation(loadedParams, step);
        set({ params: loadedParams, result, warnings, hasErrors });
      },

      resetToDefault: () => {
        const step = get().spectrumStep;
        const { result, warnings, hasErrors } = performCalculation(defaultParams, step);
        set({
          params: defaultParams,
          result,
          warnings,
          hasErrors,
          comparisonGroups: [],
        });
      },
    }),
    {
      name: 'film-interference-store',
      partialize: (state) => ({
        params: state.params,
        spectrumStep: state.spectrumStep,
        comparisonGroups: state.comparisonGroups,
      }),
    }
  )
);
