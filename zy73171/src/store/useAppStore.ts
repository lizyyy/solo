import { create } from 'zustand';
import type {
  BoundarySample,
  ExceptionRecord,
  FilterConditions,
  FilterSnapshot,
  ParamRow,
  ParamTable,
  ReviewResult,
} from '../types';
import { mockExceptions, mockParamTable, mockSamples, mockSnapshots } from '../data/mockData';

interface AppState {
  paramTable: ParamTable;
  samples: BoundarySample[];
  exceptions: ExceptionRecord[];
  snapshots: FilterSnapshot[];
  lastReviewResult: ReviewResult | null;
  selectedSampleId: string | null;
  activeSnapshotId: string | null;
  exportHistory: { id: string; snapshotId: string; fileName: string; exportedAt: string }[];

  setSelectedSampleId: (id: string | null) => void;
  setLastReviewResult: (result: ReviewResult | null) => void;
  addParamChange: (rowId: string, newValue: string, newUnit: string | null, changedBy: string) => void;
  addParamRow: (row: Omit<ParamRow, 'id' | 'changes'>) => void;
  addException: (record: Omit<ExceptionRecord, 'id' | 'createdAt'>) => void;
  updateExceptionStatus: (id: string, status: ExceptionRecord['status']) => void;
  createSnapshot: (name: string, conditions: FilterConditions) => FilterSnapshot;
  applySnapshot: (snapshotId: string | null) => void;
  recordExport: (snapshotId: string, fileName: string) => void;
  addSample: (sample: Omit<BoundarySample, 'id' | 'createdAt'>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  paramTable: mockParamTable,
  samples: mockSamples,
  exceptions: mockExceptions,
  snapshots: mockSnapshots,
  lastReviewResult: null,
  selectedSampleId: null,
  activeSnapshotId: null,
  exportHistory: [],

  setSelectedSampleId: (id) => set({ selectedSampleId: id }),
  setLastReviewResult: (result) => set({ lastReviewResult: result }),

  addParamChange: (rowId, newValue, newUnit, changedBy) =>
    set((state) => {
      const row = state.paramTable.rows.find((r) => r.id === rowId);
      if (!row) return {};
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const change = {
        id: `c-${Date.now()}`,
        oldValue: row.value ?? '∅',
        newValue,
        changedBy,
        changedAt: now,
        batchNo: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      };
      const newRows = state.paramTable.rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              value: newValue,
              unit: newUnit ?? r.unit,
              isEmptySet: newValue === '∅' || newValue === '',
              missingUnit: !newUnit,
              changes: [...r.changes, change],
            }
          : r
      );
      return { paramTable: { ...state.paramTable, rows: newRows } };
    }),

  addParamRow: (row) =>
    set((state) => ({
      paramTable: {
        ...state.paramTable,
        rows: [...state.paramTable.rows, { ...row, id: `r-${Date.now()}`, changes: [] }],
      },
    })),

  addException: (record) =>
    set((state) => ({
      exceptions: [
        { ...record, id: `e-${Date.now()}`, createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19) },
        ...state.exceptions,
      ],
    })),

  updateExceptionStatus: (id, status) =>
    set((state) => ({
      exceptions: state.exceptions.map((e) => (e.id === id ? { ...e, status } : e)),
    })),

  createSnapshot: (name, conditions) => {
    const snap: FilterSnapshot = {
      id: `snap-${Math.random().toString(36).slice(2, 8)}`,
      name,
      conditions,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    set((state) => ({ snapshots: [snap, ...state.snapshots] }));
    return snap;
  },

  applySnapshot: (snapshotId) => set({ activeSnapshotId: snapshotId }),

  recordExport: (snapshotId, fileName) =>
    set((state) => ({
      exportHistory: [
        {
          id: `exp-${Date.now()}`,
          snapshotId,
          fileName,
          exportedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        },
        ...state.exportHistory,
      ],
      snapshots: state.snapshots.map((s) =>
        s.id === snapshotId ? { ...s, exportedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) } : s
      ),
    })),

  addSample: (sample) =>
    set((state) => ({
      samples: [
        ...state.samples,
        { ...sample, id: `s-${Date.now()}`, createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19) },
      ],
    })),

  getSnapshotById: (id: string) => get().snapshots.find((s) => s.id === id),
}));
