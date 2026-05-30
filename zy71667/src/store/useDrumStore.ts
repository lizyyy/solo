import { create } from 'zustand';
import type { DrumParams, CalcResult } from '../utils/calculator';
import { validateAndCalculate } from '../utils/calculator';
import type { DiameterUnit, TensionUnit, MaterialKey } from '../utils/constants';

interface DrumStore {
  params: DrumParams;
  result: CalcResult | null;
  history: DrumParams[];
  showOverwriteWarning: boolean;
  overwriteTargetId: string | null;

  setDiameter: (d: number) => void;
  setDiameterUnit: (u: DiameterUnit) => void;
  setTension: (t: number) => void;
  setTensionUnit: (u: TensionUnit) => void;
  setMaterial: (m: MaterialKey) => void;
  setCustomDensity: (d: number) => void;
  setTargetFreq: (f: number) => void;
  setTargetNote: (n: string) => void;
  setNotes: (n: string) => void;
  calculate: () => void;
  saveToHistory: () => void;
  deleteFromHistory: (id: string) => void;
  loadFromHistory: (id: string) => void;
  clearHistory: () => void;
  dismissOverwriteWarning: () => void;
  confirmOverwrite: () => void;
  loadDemoData: (index: number) => void;
}

function createDefaultParams(): DrumParams {
  return {
    id: '',
    diameter: 14,
    diameterUnit: 'inch',
    tension: 2000,
    tensionUnit: 'N/m',
    material: 'mylar',
    customDensity: 0.19,
    targetFreq: 0,
    targetNote: '',
    notes: '',
    createdAt: Date.now(),
  };
}

function loadHistory(): DrumParams[] {
  try {
    const raw = localStorage.getItem('drum-history');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveHistory(history: DrumParams[]) {
  try {
    localStorage.setItem('drum-history', JSON.stringify(history));
  } catch { /* ignore */ }
}

export const useDrumStore = create<DrumStore>((set, get) => ({
  params: createDefaultParams(),
  result: null,
  history: loadHistory(),
  showOverwriteWarning: false,
  overwriteTargetId: null,

  setDiameter: (d) => set(s => ({ params: { ...s.params, diameter: d } })),
  setDiameterUnit: (u) => set(s => ({ params: { ...s.params, diameterUnit: u } })),
  setTension: (t) => set(s => ({ params: { ...s.params, tension: t } })),
  setTensionUnit: (u) => set(s => ({ params: { ...s.params, tensionUnit: u } })),
  setMaterial: (m) => set(s => ({ params: { ...s.params, material: m } })),
  setCustomDensity: (d) => set(s => ({ params: { ...s.params, customDensity: d } })),
  setTargetFreq: (f) => set(s => ({ params: { ...s.params, targetFreq: f } })),
  setTargetNote: (n) => set(s => ({ params: { ...s.params, targetNote: n } })),
  setNotes: (n) => set(s => ({ params: { ...s.params, notes: n } })),

  calculate: () => {
    const { params } = get();
    const result = validateAndCalculate(params);
    set({ result });
  },

  saveToHistory: () => {
    const { params, history } = get();
    const id = `drum_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: DrumParams = { ...params, id, createdAt: Date.now() };

    const existing = history.find(h =>
      h.diameter === record.diameter &&
      h.diameterUnit === record.diameterUnit &&
      h.material === record.material &&
      Math.abs(h.tension - record.tension) < 1
    );

    if (existing) {
      set({ showOverwriteWarning: true, overwriteTargetId: existing.id });
      return;
    }

    const newHistory = [record, ...history];
    saveHistory(newHistory);
    set({ history: newHistory, showOverwriteWarning: false, overwriteTargetId: null });
  },

  deleteFromHistory: (id) => {
    const { history } = get();
    const newHistory = history.filter(h => h.id !== id);
    saveHistory(newHistory);
    set({ history: newHistory });
  },

  loadFromHistory: (id) => {
    const { history } = get();
    const record = history.find(h => h.id === id);
    if (record) {
      const result = validateAndCalculate(record);
      set({ params: { ...record }, result });
    }
  },

  clearHistory: () => {
    saveHistory([]);
    set({ history: [] });
  },

  dismissOverwriteWarning: () => set({ showOverwriteWarning: false, overwriteTargetId: null }),

  confirmOverwrite: () => {
    const { params, history, overwriteTargetId } = get();
    if (!overwriteTargetId) return;
    const newHistory = history.map(h =>
      h.id === overwriteTargetId ? { ...params, id: overwriteTargetId, createdAt: Date.now() } : h
    );
    saveHistory(newHistory);
    set({ history: newHistory, showOverwriteWarning: false, overwriteTargetId: null });
  },

  loadDemoData: (index) => {
    const demos: DrumParams[] = [
      {
        id: '',
        diameter: 14,
        diameterUnit: 'inch',
        tension: 2000,
        tensionUnit: 'N/m',
        material: 'mylar',
        customDensity: 0.19,
        targetFreq: 246.94,
        targetNote: 'B3',
        notes: '标准 14 英寸军鼓，Mylar 鼓皮，正常工况',
        createdAt: Date.now(),
      },
      {
        id: '',
        diameter: 6,
        diameterUnit: 'inch',
        tension: 8000,
        tensionUnit: 'N/m',
        material: 'kevlar',
        customDensity: 0.23,
        targetFreq: 0,
        targetNote: '',
        notes: '6 英寸 piccolo 军鼓，极高张力，需关注倍频误判',
        createdAt: Date.now(),
      },
      {
        id: '',
        diameter: 14,
        diameterUnit: 'inch',
        tension: 1800,
        tensionUnit: 'N/m',
        material: 'calf',
        customDensity: 0.20,
        targetFreq: 220.00,
        targetNote: 'A3',
        notes: '旧小牛皮鼓皮，面密度因老化偏低（正常 0.28，实测约 0.20），频率偏差可能超过 15%',
        createdAt: Date.now(),
      },
    ];

    const demo = demos[index] || demos[0];
    const result = validateAndCalculate(demo);
    set({ params: demo, result });
  },
}));
