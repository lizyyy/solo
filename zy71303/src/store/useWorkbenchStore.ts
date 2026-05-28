import { create } from 'zustand';
import type { StringParams, TensionResult, Anomaly, LinearDensityUnit } from '@/utils/tensionCalc';
import { calculateAllTensions } from '@/utils/tensionCalc';
import { createDefaultStrings, TUNING_PRESETS, SAMPLE_CASES } from '@/utils/presets';
import type { TuningPreset, SampleCase } from '@/utils/presets';

interface WorkbenchFilter {
  stringIds: number[];
  tensionRange: [number, number] | null;
  anomalyOnly: boolean;
}

interface WorkbenchState {
  strings: StringParams[];
  results: TensionResult[];
  totalTension: number;
  allAnomalies: Anomaly[];
  activePreset: string;
  comparisonPreset: string | null;
  comparisonResults: TensionResult[] | null;
  comparisonTotalTension: number | null;
  filter: WorkbenchFilter;
  showFormula: boolean;

  setStringParam: (id: number, field: keyof StringParams, value: string | number | LinearDensityUnit) => void;
  setStringRawInput: (id: number, field: keyof StringParams['rawInputs'], value: string) => void;
  applyPreset: (presetName: string) => void;
  setComparisonPreset: (presetName: string | null) => void;
  loadSampleCase: (index: number) => void;
  setFilter: (filter: Partial<WorkbenchFilter>) => void;
  toggleFormula: () => void;
  recalculate: () => void;
}

function recalc(strings: StringParams[]): { results: TensionResult[]; totalTension: number; allAnomalies: Anomaly[] } {
  return calculateAllTensions(strings);
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  strings: createDefaultStrings(648),
  results: [],
  totalTension: 0,
  allAnomalies: [],
  activePreset: 'Standard',
  comparisonPreset: null,
  comparisonResults: null,
  comparisonTotalTension: null,
  filter: {
    stringIds: [1, 2, 3, 4, 5, 6],
    tensionRange: null,
    anomalyOnly: false,
  },
  showFormula: false,

  setStringParam: (id, field, value) => {
    const strings = get().strings.map(s => {
      if (s.id !== id) return s;
      return { ...s, [field]: value };
    });
    const { results, totalTension, allAnomalies } = recalc(strings);
    set({ strings, results, totalTension, allAnomalies });
  },

  setStringRawInput: (id, field, value) => {
    const strings = get().strings.map(s => {
      if (s.id !== id) return s;
      return {
        ...s,
        rawInputs: { ...s.rawInputs, [field]: value },
        ...(field === 'scaleLength' ? { scaleLength: parseFloat(value) || 0 } : {}),
        ...(field === 'frequency' ? { frequency: parseFloat(value) || 0 } : {}),
        ...(field === 'linearDensity' ? { linearDensity: parseFloat(value) || 0 } : {}),
        ...(field === 'gauge' ? { gauge: parseFloat(value) || 0 } : {}),
      };
    });
    const { results, totalTension, allAnomalies } = recalc(strings);
    set({ strings, results, totalTension, allAnomalies });
  },

  applyPreset: (presetName) => {
    const preset = TUNING_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    const currentStrings = get().strings;
    const newStrings = currentStrings.map((s, i) => ({
      ...s,
      targetNote: preset.strings[i].note,
      frequency: preset.strings[i].frequency,
      rawInputs: { ...s.rawInputs, frequency: String(preset.strings[i].frequency) },
    }));
    const { results, totalTension, allAnomalies } = recalc(newStrings);
    set({
      strings: newStrings,
      results,
      totalTension,
      allAnomalies,
      activePreset: presetName,
    });
  },

  setComparisonPreset: (presetName) => {
    if (!presetName) {
      set({ comparisonPreset: null, comparisonResults: null, comparisonTotalTension: null });
      return;
    }
    const preset = TUNING_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    const currentStrings = get().strings;
    const compStrings = currentStrings.map((s, i) => ({
      ...s,
      targetNote: preset.strings[i].note,
      frequency: preset.strings[i].frequency,
    }));
    const { results, totalTension } = recalc(compStrings);
    set({
      comparisonPreset: presetName,
      comparisonResults: results,
      comparisonTotalTension: totalTension,
    });
  },

  loadSampleCase: (index) => {
    const sample = SAMPLE_CASES[index];
    if (!sample) return;
    const { results, totalTension, allAnomalies } = recalc(sample.strings);
    set({
      strings: sample.strings,
      results,
      totalTension,
      allAnomalies,
      activePreset: 'Custom',
      comparisonPreset: null,
      comparisonResults: null,
      comparisonTotalTension: null,
    });
  },

  setFilter: (partial) => {
    set({ filter: { ...get().filter, ...partial } });
  },

  toggleFormula: () => {
    set({ showFormula: !get().showFormula });
  },

  recalculate: () => {
    const { strings } = get();
    const { results, totalTension, allAnomalies } = recalc(strings);
    set({ results, totalTension, allAnomalies });
  },
}));

export type { TuningPreset, SampleCase };
