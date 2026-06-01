import { create } from 'zustand';
import type { ShipRecord, FilterState, Scheme, DiffResult, SourceType, AnomalyType } from '@/types';
import { SAMPLE_DATA, SUPPLEMENT_RECORD } from '@/data/sampleData';

interface AppState {
  records: ShipRecord[];
  filteredRecords: ShipRecord[];
  selectedRecordId: string | null;
  filter: FilterState;
  schemes: Scheme[];
  currentSchemeId: string | null;
  diffResult: DiffResult | null;
  snapshotBeforeSupplement: ShipRecord[] | null;

  setRecords: (records: ShipRecord[]) => void;
  addRecords: (newRecords: ShipRecord[]) => DiffResult;
  addSupplementRecord: () => DiffResult;
  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;
  selectRecord: (id: string | null) => void;
  updateRecordRemark: (id: string, remark: string) => void;
  saveScheme: (name: string, note: string, cameraPosition: [number, number, number], cameraTarget: [number, number, number]) => void;
  loadScheme: (id: string) => Scheme | null;
  deleteScheme: (id: string) => void;
  clearDiff: () => void;
}

const DEFAULT_FILTER: FilterState = {
  sources: ['GIS', '巡检', 'Excel'],
  timeRange: ['2025-03-15T00:00:00', '2025-03-15T23:59:59'],
  anomalyTypes: ['正常', '空值', '重复', '边界'],
};

function applyFilter(records: ShipRecord[], filter: FilterState): ShipRecord[] {
  return records.filter((r) => {
    if (!filter.sources.includes(r.source)) return false;
    if (!filter.anomalyTypes.includes(r.anomalyType)) return false;
    if (r.timestamp < filter.timeRange[0] || r.timestamp > filter.timeRange[1]) return false;
    return true;
  });
}

function computeAnomalyDistribution(records: ShipRecord[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const r of records) {
    dist[r.anomalyType] = (dist[r.anomalyType] || 0) + 1;
  }
  return dist;
}

function loadSchemesFromStorage(): Scheme[] {
  try {
    const raw = localStorage.getItem('sandtable_schemes');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSchemesToStorage(schemes: Scheme[]) {
  localStorage.setItem('sandtable_schemes', JSON.stringify(schemes));
}

export const useStore = create<AppState>((set, get) => ({
  records: SAMPLE_DATA,
  filteredRecords: applyFilter(SAMPLE_DATA, DEFAULT_FILTER),
  selectedRecordId: null,
  filter: { ...DEFAULT_FILTER },
  schemes: loadSchemesFromStorage(),
  currentSchemeId: null,
  diffResult: null,
  snapshotBeforeSupplement: null,

  setRecords: (records) => {
    const { filter } = get();
    set({ records, filteredRecords: applyFilter(records, filter) });
  },

  addRecords: (newRecords) => {
    const { records, filter } = get();
    const distBefore = computeAnomalyDistribution(records);
    const updated = [...records, ...newRecords];
    const distAfter = computeAnomalyDistribution(updated);
    const diff: DiffResult = {
      addedCount: newRecords.length,
      changedCount: 0,
      anomalyDistributionBefore: distBefore,
      anomalyDistributionAfter: distAfter,
    };
    set({
      records: updated,
      filteredRecords: applyFilter(updated, filter),
      diffResult: diff,
    });
    return diff;
  },

  addSupplementRecord: () => {
    const { records, filter } = get();
    const snapshot = [...records];
    const distBefore = computeAnomalyDistribution(records);
    const updated = [...records, SUPPLEMENT_RECORD];
    const distAfter = computeAnomalyDistribution(updated);
    const diff: DiffResult = {
      addedCount: 1,
      changedCount: 0,
      anomalyDistributionBefore: distBefore,
      anomalyDistributionAfter: distAfter,
    };
    set({
      records: updated,
      filteredRecords: applyFilter(updated, filter),
      diffResult: diff,
      snapshotBeforeSupplement: snapshot,
    });
    return diff;
  },

  setFilter: (partial) => {
    const { records, filter } = get();
    const newFilter = { ...filter, ...partial };
    set({ filter: newFilter, filteredRecords: applyFilter(records, newFilter) });
  },

  resetFilter: () => {
    const { records } = get();
    set({ filter: { ...DEFAULT_FILTER }, filteredRecords: applyFilter(records, DEFAULT_FILTER) });
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  updateRecordRemark: (id, remark) => {
    const { records, filter } = get();
    const updated = records.map((r) => (r.id === id ? { ...r, remark } : r));
    set({ records: updated, filteredRecords: applyFilter(updated, filter) });
  },

  saveScheme: (name, note, cameraPosition, cameraTarget) => {
    const { filter, filteredRecords, schemes } = get();
    const scheme: Scheme = {
      id: `scheme-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      filterSnapshot: { ...filter },
      cameraPosition,
      cameraTarget,
      note,
      recordCount: filteredRecords.length,
    };
    const updated = [...schemes, scheme];
    saveSchemesToStorage(updated);
    set({ schemes: updated, currentSchemeId: scheme.id });
  },

  loadScheme: (id) => {
    const { schemes, records } = get();
    const scheme = schemes.find((s) => s.id === id) || null;
    if (scheme) {
      set({
        currentSchemeId: id,
        filter: { ...scheme.filterSnapshot },
        filteredRecords: applyFilter(records, scheme.filterSnapshot),
      });
    }
    return scheme;
  },

  deleteScheme: (id) => {
    const { schemes } = get();
    const updated = schemes.filter((s) => s.id !== id);
    saveSchemesToStorage(updated);
    set({ schemes: updated });
  },

  clearDiff: () => set({ diffResult: null, snapshotBeforeSupplement: null }),
}));
