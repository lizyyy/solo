import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PresetStore, StoreState, Preset, Comparison, Annotation } from '@/types';
import { generateId } from '@/utils/versionParser';
import { comparePresets } from '@/utils/diffComparator';
import { getSamplePresets } from '@/data/sampleData';

const initialState: StoreState = {
  presets: [],
  comparisons: [],
  annotations: [],
  currentOperator: '阿蓝',
  activeComparisonId: null,
};

export const usePresetStore = create<PresetStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addPreset: (preset) => {
        const now = Date.now();
        const newPreset: Preset = {
          ...preset,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          presets: [...state.presets, newPreset],
        }));
      },

    updatePreset: (id, updates) => {
      set((state) => ({
        presets: state.presets.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        ),
      }));
    },

    deletePreset: (id) => {
      set((state) => ({
        presets: state.presets.filter((p) => p.id !== id),
      }));
    },

    createComparison: (basePresetId, targetPresetId, reason) => {
      const state = get();
      const basePreset = state.presets.find((p) => p.id === basePresetId);
      const targetPreset = state.presets.find((p) => p.id === targetPresetId);
      
      if (!basePreset || !targetPreset) {
        throw new Error('预设不存在');
      }

      const differences = comparePresets(basePreset.parameters, targetPreset.parameters);
      
      const comparison: Comparison = {
        id: generateId(),
        basePresetId,
        targetPresetId,
        differences,
        reason,
        operator: state.currentOperator,
        createdAt: Date.now(),
        status: 'pending',
      };

      set((s) => ({
        comparisons: [...s.comparisons, comparison],
        activeComparisonId: comparison.id,
      }));

      return comparison;
    },

    updateComparison: (id, updates) => {
      set((state) => ({
        comparisons: state.comparisons.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
    },

    deleteComparison: (id) => {
      set((state) => ({
        comparisons: state.comparisons.filter((c) => c.id !== id),
        annotations: state.annotations.filter((a) => a.comparisonId !== id),
        activeComparisonId: state.activeComparisonId === id ? null : state.activeComparisonId,
      }));
    },

    addAnnotation: (annotation) => {
      const newAnnotation: Annotation = {
        ...annotation,
        id: generateId(),
        createdAt: Date.now(),
      };
      set((state) => ({
        annotations: [...state.annotations, newAnnotation],
      }));
    },

    updateAnnotation: (id, updates) => {
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }));
    },

    deleteAnnotation: (id) => {
      set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== id),
      }));
    },

    setActiveComparison: (id) => {
      set({ activeComparisonId: id });
    },

    setCurrentOperator: (name) => {
      set({ currentOperator: name });
    },

    loadSampleData: () => {
      const samplePresets = getSamplePresets();
      const now = Date.now();
      
      const presetsWithIds = samplePresets.map((p, index) => ({
        ...p,
        id: generateId(),
        createdAt: now - (samplePresets.length - index) * 3600000,
        updatedAt: now - (samplePresets.length - index) * 3600000,
      }));
      
      set({
        presets: presetsWithIds,
        comparisons: [],
        annotations: [],
      });
    },

    clearAllData: () => {
      set({
        presets: [],
        comparisons: [],
        annotations: [],
        activeComparisonId: null,
      });
    },
  }),
    {
      name: 'synth-preset-store',
    }
  )
);

export const useActiveComparison = () => {
  const { activeComparisonId, comparisons, presets, annotations } = usePresetStore();
  
  const comparison = comparisons.find((c) => c.id === activeComparisonId);
  const basePreset = comparison ? presets.find((p) => p.id === comparison.basePresetId) : undefined;
  const targetPreset = comparison ? presets.find((p) => p.id === comparison.targetPresetId) : undefined;
  const comparisonAnnotations = annotations.filter((a) => a.comparisonId === activeComparisonId);

  return {
    comparison,
    basePreset,
    targetPreset,
    annotations: comparisonAnnotations,
  };
};
