import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SensorRecord,
  CalculationParams,
  LocationResult,
  CalculationSnapshot,
  DataValidationIssue,
  ManualCorrection,
  PageType,
} from '@/types';
import { defaultCalculationParams } from '@/data/sampleData';

interface AppState {
  currentPage: PageType;
  sensorRecords: SensorRecord[];
  calculationParams: CalculationParams;
  currentResult: LocationResult | null;
  isCalculating: boolean;
  validationIssues: DataValidationIssue[];
  manualCorrections: ManualCorrection[];
  snapshots: CalculationSnapshot[];
  selectedSnapshots: string[];

  setCurrentPage: (page: PageType) => void;
  setSensorRecords: (records: SensorRecord[]) => void;
  addSensorRecord: (record: SensorRecord) => void;
  updateSensorRecord: (id: string, updates: Partial<SensorRecord>) => void;
  removeSensorRecord: (id: string) => void;
  setCalculationParams: (params: Partial<CalculationParams>) => void;
  resetCalculationParams: () => void;
  setCurrentResult: (result: LocationResult | null) => void;
  setIsCalculating: (isCalculating: boolean) => void;
  setValidationIssues: (issues: DataValidationIssue[]) => void;
  addManualCorrection: (correction: ManualCorrection) => void;
  removeManualCorrection: (recordId: string, field: string) => void;
  createSnapshot: (name: string, operator: string, notes: string) => void;
  deleteSnapshot: (id: string) => void;
  toggleSnapshotSelection: (id: string) => void;
  clearSelectedSnapshots: () => void;
  loadSnapshot: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentPage: 'dashboard',
      sensorRecords: [],
      calculationParams: defaultCalculationParams,
      currentResult: null,
      isCalculating: false,
      validationIssues: [],
      manualCorrections: [],
      snapshots: [],
      selectedSnapshots: [],

      setCurrentPage: (page) => set({ currentPage: page }),

      setSensorRecords: (records) => set({ sensorRecords: records }),

      addSensorRecord: (record) =>
        set((state) => ({
          sensorRecords: [...state.sensorRecords, record],
        })),

      updateSensorRecord: (id, updates) =>
        set((state) => ({
          sensorRecords: state.sensorRecords.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      removeSensorRecord: (id) =>
        set((state) => ({
          sensorRecords: state.sensorRecords.filter((r) => r.id !== id),
        })),

      setCalculationParams: (params) =>
        set((state) => ({
          calculationParams: { ...state.calculationParams, ...params },
        })),

      resetCalculationParams: () =>
        set({ calculationParams: defaultCalculationParams }),

      setCurrentResult: (result) => set({ currentResult: result }),

      setIsCalculating: (isCalculating) => set({ isCalculating }),

      setValidationIssues: (issues) => set({ validationIssues: issues }),

      addManualCorrection: (correction) =>
        set((state) => ({
          manualCorrections: [...state.manualCorrections, correction],
        })),

      removeManualCorrection: (recordId, field) =>
        set((state) => ({
          manualCorrections: state.manualCorrections.filter(
            (c) => !(c.recordId === recordId && c.field === field)
          ),
        })),

      createSnapshot: (name, operator, notes) => {
        const state = get();
        const snapshot: CalculationSnapshot = {
          id: crypto.randomUUID(),
          name,
          timestamp: new Date().toISOString(),
          operator,
          params: { ...state.calculationParams },
          inputRecords: [...state.sensorRecords],
          result: state.currentResult
            ? { ...state.currentResult }
            : ({} as LocationResult),
          manualCorrections: [...state.manualCorrections],
          notes,
        };
        set((prev) => ({
          snapshots: [snapshot, ...prev.snapshots],
        }));
      },

      deleteSnapshot: (id) =>
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.id !== id),
          selectedSnapshots: state.selectedSnapshots.filter((s) => s !== id),
        })),

      toggleSnapshotSelection: (id) =>
        set((state) => ({
          selectedSnapshots: state.selectedSnapshots.includes(id)
            ? state.selectedSnapshots.filter((s) => s !== id)
            : [...state.selectedSnapshots, id],
        })),

      clearSelectedSnapshots: () => set({ selectedSnapshots: [] }),

      loadSnapshot: (id) => {
        const snapshot = get().snapshots.find((s) => s.id === id);
        if (snapshot) {
          set({
            sensorRecords: [...snapshot.inputRecords],
            calculationParams: { ...snapshot.params },
            currentResult: snapshot.result,
            manualCorrections: [...snapshot.manualCorrections],
          });
        }
      },
    }),
    {
      name: 'seismic-location-storage',
      partialize: (state) => ({
        snapshots: state.snapshots,
        calculationParams: state.calculationParams,
      }),
    }
  )
);
