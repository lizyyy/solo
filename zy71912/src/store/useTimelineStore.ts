import { create } from 'zustand';
import type {
  TimelineRecord,
  Anomaly,
  Correction,
  VersionSnapshot,
  RecordStatus,
  ImportResult,
} from '@/types';
import { generateId } from '@/utils/time';
import { detectAllAnomalies, detectDriftZones } from '@/utils/detection';
import { getInitialData } from '@/data/mockData';

interface TimelineState {
  records: TimelineRecord[];
  anomalies: Anomaly[];
  corrections: Correction[];
  snapshots: VersionSnapshot[];
  selectedRecordId: string | null;
  zoomLevel: number;
  scrollOffset: number;
  currentSnapshotId: string | null;
  operator: string;

  addRecords: (records: TimelineRecord[]) => void;
  updateRecord: (id: string, updates: Partial<TimelineRecord>, reason?: string) => void;
  deleteRecord: (id: string) => void;
  setRecordStatus: (id: string, status: RecordStatus) => void;
  selectRecord: (id: string | null) => void;

  addAnomaly: (anomaly: Omit<Anomaly, 'id'>) => void;
  resolveAnomaly: (id: string, explanation?: string) => void;
  updateAnomalyExplanation: (id: string, explanation: string) => void;

  addCorrection: (correction: Omit<Correction, 'id' | 'timestamp'>) => void;

  runDetection: () => void;
  importData: (data: Partial<TimelineRecord>[]) => ImportResult;
  loadInitialData: () => void;
  resetData: () => void;

  createSnapshot: (description: string) => void;
  restoreSnapshot: (snapshotId: string) => void;

  setZoomLevel: (level: number) => void;
  setScrollOffset: (offset: number) => void;
  setOperator: (name: string) => void;

  getDriftZones: () => ReturnType<typeof detectDriftZones>;
  getRecordAnomalies: (recordId: string) => Anomaly[];
  getRecordCorrections: (recordId: string) => Correction[];
}

const STORAGE_KEY = 'podcast-timeline-data';

function saveToStorage(state: Partial<TimelineState>) {
  try {
    const data = {
      records: state.records,
      anomalies: state.anomalies,
      corrections: state.corrections,
      snapshots: state.snapshots,
      operator: state.operator,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

function loadFromStorage(): Partial<TimelineState> | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load from localStorage', e);
  }
  return null;
}

export const useTimelineStore = create<TimelineState>((set, get) => {
  const initialData = getInitialData();
  const stored = loadFromStorage();

  return {
    records: stored?.records || initialData.records,
    anomalies: stored?.anomalies || initialData.anomalies,
    corrections: stored?.corrections || initialData.corrections,
    snapshots: stored?.snapshots || [],
    selectedRecordId: null,
    zoomLevel: 1,
    scrollOffset: 0,
    currentSnapshotId: null,
    operator: stored?.operator || '剪辑师小王',

    addRecords: (newRecords) => {
      set((state) => {
        const updated = { ...state, records: [...state.records, ...newRecords] };
        saveToStorage(updated);
        return updated;
      });
      get().runDetection();
    },

    updateRecord: (id, updates, reason) => {
      const state = get();
      const record = state.records.find(r => r.id === id);
      if (!record) return;

      const corrections: Correction[] = [];
      Object.entries(updates).forEach(([key, value]) => {
        const oldValue = String(record[key as keyof TimelineRecord]);
        const newValue = String(value);
        if (oldValue !== newValue) {
          corrections.push({
            id: generateId(),
            recordId: id,
            fieldName: key,
            oldValue,
            newValue,
            operator: state.operator,
            timestamp: new Date().toISOString(),
            reason: reason || '更新字段',
          });
        }
      });

      set((state) => {
        const updated = {
          ...state,
          records: state.records.map(r =>
            r.id === id
              ? { ...r, ...updates, updatedAt: new Date().toISOString() }
              : r
          ),
          corrections: [...state.corrections, ...corrections],
        };
        saveToStorage(updated);
        return updated;
      });
    },

    deleteRecord: (id) => {
      set((state) => {
        const updated = {
          ...state,
          records: state.records.filter(r => r.id !== id),
          anomalies: state.anomalies.filter(a => a.recordId !== id),
          corrections: state.corrections.filter(c => c.recordId !== id),
          selectedRecordId: state.selectedRecordId === id ? null : state.selectedRecordId,
        };
        saveToStorage(updated);
        return updated;
      });
    },

    setRecordStatus: (id, status) => {
      get().updateRecord(id, { status }, `状态变更为: ${status}`);
    },

    selectRecord: (id) => {
      set({ selectedRecordId: id });
    },

    addAnomaly: (anomaly) => {
      set((state) => {
        const updated = {
          ...state,
          anomalies: [...state.anomalies, { ...anomaly, id: generateId() }],
        };
        saveToStorage(updated);
        return updated;
      });
    },

    resolveAnomaly: (id, explanation) => {
      set((state) => {
        const updated = {
          ...state,
          anomalies: state.anomalies.map(a =>
            a.id === id
              ? { ...a, resolved: true, resolvedAt: new Date().toISOString(), explanation: explanation || a.explanation }
              : a
          ),
        };
        saveToStorage(updated);
        return updated;
      });
    },

    updateAnomalyExplanation: (id, explanation) => {
      set((state) => {
        const updated = {
          ...state,
          anomalies: state.anomalies.map(a =>
            a.id === id ? { ...a, explanation } : a
          ),
        };
        saveToStorage(updated);
        return updated;
      });
    },

    addCorrection: (correction) => {
      set((state) => {
        const updated = {
          ...state,
          corrections: [
            ...state.corrections,
            { ...correction, id: generateId(), timestamp: new Date().toISOString() },
          ],
        };
        saveToStorage(updated);
        return updated;
      });
    },

    runDetection: () => {
      const state = get();
      const detected = detectAllAnomalies(state.records);
      const existingIds = new Set(state.anomalies.map(a => `${a.recordId}-${a.type}`));
      const newAnomalies = detected.filter(d => !existingIds.has(`${d.recordId}-${d.type}`));
      if (newAnomalies.length > 0) {
        set((state) => {
          const updated = { ...state, anomalies: [...state.anomalies, ...newAnomalies] };
          saveToStorage(updated);
          return updated;
        });
      }
    },

    importData: (data) => {
      const records: TimelineRecord[] = data.map((item, index) => ({
        id: item.id || `imported-${Date.now()}-${index}`,
        type: item.type || 'clip',
        startTime: item.startTime ?? 0,
        duration: item.duration ?? 0,
        title: item.title || '未命名',
        description: item.description || '',
        status: item.status || 'pending',
        source: 'imported',
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        meta: item.meta,
      }));

      const anomalies = detectAllAnomalies(records);
      const stats = {
        total: records.length,
        normal: records.filter(r => !anomalies.some(a => a.recordId === r.id)).length,
        late: anomalies.filter(a => a.type === 'late').length,
        duplicates: anomalies.filter(a => a.type === 'duplicate').length,
        missing: anomalies.filter(a => a.type === 'missing').length,
      };

      set((state) => {
        const updated = {
          ...state,
          records: [...state.records, ...records],
          anomalies: [...state.anomalies, ...anomalies],
        };
        saveToStorage(updated);
        return updated;
      });

      return { records, anomalies, stats };
    },

    loadInitialData: () => {
      const initial = getInitialData();
      const detected = detectAllAnomalies(initial.records);
      const allAnomalies = [...initial.anomalies, ...detected];
      set({
        records: initial.records,
        anomalies: allAnomalies,
        corrections: initial.corrections,
        snapshots: [],
      });
    },

    resetData: () => {
      localStorage.removeItem(STORAGE_KEY);
      const initial = getInitialData();
      const detected = detectAllAnomalies(initial.records);
      set({
        records: initial.records,
        anomalies: [...initial.anomalies, ...detected],
        corrections: initial.corrections,
        snapshots: [],
        selectedRecordId: null,
        currentSnapshotId: null,
      });
    },

    createSnapshot: (description) => {
      const state = get();
      const snapshot: VersionSnapshot = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        records: JSON.parse(JSON.stringify(state.records)),
        anomalies: JSON.parse(JSON.stringify(state.anomalies)),
        description,
      };
      set((state) => {
        const updated = { ...state, snapshots: [...state.snapshots, snapshot] };
        saveToStorage(updated);
        return updated;
      });
    },

    restoreSnapshot: (snapshotId) => {
      const state = get();
      const snapshot = state.snapshots.find(s => s.id === snapshotId);
      if (!snapshot) return;
      set({
        records: JSON.parse(JSON.stringify(snapshot.records)),
        anomalies: JSON.parse(JSON.stringify(snapshot.anomalies)),
        currentSnapshotId: snapshotId,
      });
    },

    setZoomLevel: (level) => {
      set({ zoomLevel: Math.max(0.25, Math.min(4, level)) });
    },

    setScrollOffset: (offset) => {
      set({ scrollOffset: Math.max(0, offset) });
    },

    setOperator: (name) => {
      set({ operator: name });
    },

    getDriftZones: () => {
      return detectDriftZones(get().records);
    },

    getRecordAnomalies: (recordId) => {
      return get().anomalies.filter(a => a.recordId === recordId);
    },

    getRecordCorrections: (recordId) => {
      return get().corrections.filter(c => c.recordId === recordId);
    },
  };
});
