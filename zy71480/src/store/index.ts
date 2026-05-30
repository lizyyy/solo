import { create } from 'zustand';
import {
  Speaker,
  CalculationResult,
  ValidationError,
  VersionMeta,
  MeasurePoint,
  StoreType,
} from '../types';
import {
  calculateAllPoints,
  generateMeasurePoints,
} from '../utils/acoustics';
import { validateResults, attachErrorsToResults } from '../utils/validation';
import { exportJSON, exportCSV, verifyDataConsistency } from '../utils/export';

const generateId = (): string => {
  return `spk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getInitialVersionMeta = (): VersionMeta => ({
  version: '1.0.0',
  source: '',
  timestamp: new Date().toISOString(),
  speakerCount: 0,
  pointCount: 0,
  frequency: 1000,
  splThreshold: 110,
});

const initialSpeakers: Speaker[] = [];

const initialMeasurePoints: MeasurePoint[] = generateMeasurePoints(0, 20, 0, 15, 1);

export const useStore = create<StoreType>((set, get) => ({
  speakers: initialSpeakers,
  measurePoints: initialMeasurePoints,
  results: [],
  errors: [],
  versionMeta: getInitialVersionMeta(),
  selectedResultId: null,
  splThreshold: 110,
  frequency: 1000,
  isCalculating: false,

  addSpeaker: (speaker) => {
    const newSpeaker: Speaker = {
      ...speaker,
      id: generateId(),
    };
    set((state) => ({
      speakers: [...state.speakers, newSpeaker],
    }));
  },

  updateSpeaker: (id, speaker) => {
    set((state) => ({
      speakers: state.speakers.map((s) =>
        s.id === id ? { ...s, ...speaker } : s
      ),
    }));
  },

  removeSpeaker: (id) => {
    set((state) => ({
      speakers: state.speakers.filter((s) => s.id !== id),
    }));
  },

  setSpeakers: (speakers) => {
    set({ speakers });
  },

  setSplThreshold: (threshold) => {
    set({ splThreshold: threshold });
  },

  setFrequency: (frequency) => {
    set({ frequency });
  },

  setVersionMeta: (meta) => {
    set((state) => ({
      versionMeta: { ...state.versionMeta, ...meta },
    }));
  },

  calculate: () => {
    const state = get();
    if (state.speakers.length === 0) return;

    set({ isCalculating: true });

    try {
      const rawResults = calculateAllPoints(
        state.speakers,
        state.measurePoints,
        state.frequency
      );

      const validationErrors = validateResults(
        state.speakers,
        rawResults,
        state.splThreshold
      );

      const resultsWithErrors = attachErrorsToResults(
        rawResults,
        validationErrors
      );

      const versionMeta: VersionMeta = {
        version: state.versionMeta.version,
        source: state.versionMeta.source,
        timestamp: new Date().toISOString(),
        speakerCount: state.speakers.length,
        pointCount: state.measurePoints.length,
        frequency: state.frequency,
        splThreshold: state.splThreshold,
      };

      set({
        results: resultsWithErrors,
        errors: validationErrors,
        versionMeta,
        isCalculating: false,
        selectedResultId: null,
      });
    } catch (error) {
      console.error('Calculation error:', error);
      set({ isCalculating: false });
    }
  },

  selectResult: (id) => {
    set({ selectedResultId: id });
  },

  exportJSON: () => {
    const state = get();
    if (state.results.length === 0) return;

    const isConsistent = verifyDataConsistency(state.results);
    if (!isConsistent) {
      alert('数据不一致，导出已取消。请重新计算。');
      return;
    }

    const exportData = {
      versionMeta: state.versionMeta,
      splThreshold: state.splThreshold,
      frequency: state.frequency,
      speakers: state.speakers,
      errors: state.errors,
      results: state.results,
    };

    exportJSON(exportData, state.versionMeta);
  },

  exportCSV: () => {
    const state = get();
    if (state.results.length === 0) return;

    const isConsistent = verifyDataConsistency(state.results);
    if (!isConsistent) {
      alert('数据不一致，导出已取消。请重新计算。');
      return;
    }

    exportCSV(state.results, state.versionMeta, state.errors);
  },

  loadDemoData: () => {
    const demoSpeakers: Speaker[] = [
      {
        id: generateId(),
        name: '主扩左',
        x: 2,
        y: 0,
        z: 3,
        power: 1000,
        delay: 0,
        angle: 0,
        source: '现场测量',
        version: '1.0.0',
      },
      {
        id: generateId(),
        name: '主扩右',
        x: 18,
        y: 0,
        z: 3,
        power: 1000,
        delay: 5,
        angle: 0,
        source: '现场测量',
        version: '1.0.0',
      },
      {
        id: generateId(),
        name: '补声',
        x: 10,
        y: 5,
        z: 2.5,
        power: 500,
        delay: 15,
        angle: 0,
        source: '系统设置',
        version: '1.0.0',
      },
    ];

    const newPoints = generateMeasurePoints(0, 20, 0, 15, 1);

    set({
      speakers: demoSpeakers,
      measurePoints: newPoints,
      versionMeta: {
        version: '1.0.0',
        source: '演示数据',
        timestamp: new Date().toISOString(),
        speakerCount: demoSpeakers.length,
        pointCount: newPoints.length,
        frequency: 1000,
        splThreshold: 110,
      },
    });

    setTimeout(() => {
      get().calculate();
    }, 100);
  },

  reset: () => {
    set({
      speakers: [],
      results: [],
      errors: [],
      selectedResultId: null,
      versionMeta: getInitialVersionMeta(),
    });
  },
}));
