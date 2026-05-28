import { create } from 'zustand';
import {
  HoistPoint,
  Equipment,
  CableSpec,
  CalculationParams,
  VerificationReport,
  ImportData,
} from '../types';
import { generateVerificationReport } from '../utils/calculationEngine';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  parseImportData,
} from '../utils/importExport';

interface HoistState {
  points: HoistPoint[];
  equipment: Equipment[];
  cableSpec: CableSpec;
  params: CalculationParams;
  report: VerificationReport | null;
  activeTab: 'data' | 'analysis' | 'report';
  addPoint: (point: Omit<HoistPoint, 'id'>) => void;
  updatePoint: (id: string, point: Partial<HoistPoint>) => void;
  removePoint: (id: string) => void;
  addEquipment: (eq: Omit<Equipment, 'id'>) => void;
  updateEquipment: (id: string, eq: Partial<Equipment>) => void;
  removeEquipment: (id: string) => void;
  updateCableSpec: (spec: Partial<CableSpec>) => void;
  updateParams: (params: Partial<CalculationParams>) => void;
  calculate: () => void;
  setActiveTab: (tab: 'data' | 'analysis' | 'report') => void;
  importData: (jsonString: string) => boolean;
  loadSavedData: () => boolean;
  resetData: () => void;
}

const defaultCableSpec: CableSpec = {
  diameter: 8,
  breakingLoad: 40,
  material: '镀锌钢丝绳',
};

const defaultParams: CalculationParams = {
  safetyFactor: 5,
  gravity: 9.8,
};

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useHoistStore = create<HoistState>((set, get) => ({
  points: [],
  equipment: [],
  cableSpec: defaultCableSpec,
  params: defaultParams,
  report: null,
  activeTab: 'data',

  addPoint: (point) =>
    set((state) => ({
      points: [...state.points, { ...point, id: generateId() }],
      report: null,
    })),

  updatePoint: (id, point) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === id ? { ...p, ...point } : p
      ),
      report: null,
    })),

  removePoint: (id) =>
    set((state) => ({
      points: state.points.filter((p) => p.id !== id),
      equipment: state.equipment.map((e) =>
        e.assignedPointId === id ? { ...e, assignedPointId: null } : e
      ),
      report: null,
    })),

  addEquipment: (eq) =>
    set((state) => ({
      equipment: [...state.equipment, { ...eq, id: generateId() }],
      report: null,
    })),

  updateEquipment: (id, eq) =>
    set((state) => ({
      equipment: state.equipment.map((e) =>
        e.id === id ? { ...e, ...eq } : e
      ),
      report: null,
    })),

  removeEquipment: (id) =>
    set((state) => ({
      equipment: state.equipment.filter((e) => e.id !== id),
      report: null,
    })),

  updateCableSpec: (spec) =>
    set((state) => ({
      cableSpec: { ...state.cableSpec, ...spec },
      report: null,
    })),

  updateParams: (params) =>
    set((state) => ({
      params: { ...state.params, ...params },
      report: null,
    })),

  calculate: () => {
    const state = get();
    const report = generateVerificationReport(
      state.points,
      state.equipment,
      state.cableSpec,
      state.params
    );
    set({ report });
    saveToLocalStorage(
      state.points,
      state.equipment,
      state.cableSpec,
      state.params
    );
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  importData: (jsonString) => {
    const data = parseImportData(jsonString);
    if (!data) return false;
    set({
      points: data.hoistPoints,
      equipment: data.equipment,
      cableSpec: data.cableSpec,
      params: data.params,
      report: null,
    });
    return true;
  },

  loadSavedData: () => {
    const data = loadFromLocalStorage();
    if (!data) return false;
    set({
      points: data.hoistPoints,
      equipment: data.equipment,
      cableSpec: data.cableSpec,
      params: data.params,
      report: null,
    });
    return true;
  },

  resetData: () =>
    set({
      points: [],
      equipment: [],
      cableSpec: defaultCableSpec,
      params: defaultParams,
      report: null,
    }),
}));
