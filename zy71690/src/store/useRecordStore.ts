import { create } from 'zustand';
import type { ExperimentRecord, ErrorMark, PhysicsParams, EnergyState, Body, Vector2 } from '@/types';

interface RecordStore {
  records: ExperimentRecord[];
  selectedRecordId: string | null;
  filters: {
    resultTypes: string[];
    errorTypes: string[];
    dateRange: [number | null, number | null];
    search: string;
  };
  isLoading: boolean;

  loadRecords: () => Promise<void>;
  saveRecord: (record: ExperimentRecord) => Promise<void>;
  updateRecord: (id: string, updates: Partial<ExperimentRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  selectRecord: (id: string | null) => void;
  setFilters: (filters: Partial<RecordStore['filters']>) => void;
  addNoteVersion: (recordId: string, content: string) => Promise<void>;
  updateCorrectedParams: (recordId: string, params: PhysicsParams) => Promise<void>;
  getFilteredRecords: () => ExperimentRecord[];
  clearAll: () => Promise<void>;
}

const STORAGE_KEY = 'three_body_experiment_records';

function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createExperimentRecord(params: {
  raw: {
    initialVelocity: Vector2;
    initialPosition: Vector2;
    bodies: Body[];
    physicsParams: PhysicsParams;
    launchAngle: number;
    launchSpeed: number;
  };
  conclusion: {
    result: 'escape' | 'collide' | 'orbit' | 'chaos' | 'timeout';
    duration: number;
    finalEnergy: EnergyState;
    collisionBodyId?: string;
    orbitPeriod?: number;
    escapeDistance?: number;
    errorMarks: ErrorMark[];
    summary: string;
  };
  trajectory: {
    positions: Vector2[];
    energies: EnergyState[];
    timestamps: number[];
  };
}): ExperimentRecord {
  const now = Date.now();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    raw: params.raw,
    corrected: {
      physicsParams: { ...params.raw.physicsParams },
      notes: '',
    },
    conclusion: params.conclusion,
    noteVersions: [],
    trajectory: params.trajectory,
  };
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  records: [],
  selectedRecordId: null,
  filters: {
    resultTypes: [],
    errorTypes: [],
    dateRange: [null, null],
    search: '',
  },
  isLoading: false,

  loadRecords: async () => {
    set({ isLoading: true });
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ records: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveRecord: async (record) => {
    const { records } = get();
    const newRecords = [record, ...records];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
    set({ records: newRecords });
  },

  updateRecord: async (id, updates) => {
    const { records } = get();
    const newRecords = records.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
    set({ records: newRecords });
  },

  deleteRecord: async (id) => {
    const { records } = get();
    const newRecords = records.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
    set({ records: newRecords, selectedRecordId: null });
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  addNoteVersion: async (recordId, content) => {
    const { records } = get();
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    const newVersion = {
      version: record.noteVersions.length + 1,
      content,
      timestamp: Date.now(),
    };

    const newNoteVersions = [...record.noteVersions, newVersion];
    const newRecords = records.map((r) =>
      r.id === recordId
        ? {
            ...r,
            noteVersions: newNoteVersions,
            corrected: { ...r.corrected, notes: content },
            updatedAt: Date.now(),
          }
        : r
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
    set({ records: newRecords });
  },

  updateCorrectedParams: async (recordId, params) => {
    const { records } = get();
    const newRecords = records.map((r) =>
      r.id === recordId
        ? {
            ...r,
            corrected: { ...r.corrected, physicsParams: params },
            updatedAt: Date.now(),
          }
        : r
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
    set({ records: newRecords });
  },

  getFilteredRecords: () => {
    const { records, filters } = get();

    return records.filter((record) => {
      if (filters.resultTypes.length > 0 && !filters.resultTypes.includes(record.conclusion.result)) {
        return false;
      }

      if (filters.errorTypes.length > 0) {
        const hasError = record.conclusion.errorMarks.some((e) =>
          filters.errorTypes.includes(e.type)
        );
        if (!hasError) return false;
      }

      if (filters.dateRange[0] && record.createdAt < filters.dateRange[0]) {
        return false;
      }
      if (filters.dateRange[1] && record.createdAt > filters.dateRange[1]) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchFields = [
          record.conclusion.summary,
          record.corrected.notes,
          record.conclusion.result,
          ...record.conclusion.errorMarks.map((e) => e.description),
          ...record.noteVersions.map((n) => n.content),
        ].join(' ').toLowerCase();
        if (!searchFields.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  },

  clearAll: async () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ records: [], selectedRecordId: null });
  },
}));
