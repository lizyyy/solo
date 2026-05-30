import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MeasurementRecord,
  CalculationResult,
  Anomaly,
  HistoryEntry,
  FilterState,
  DataSource,
  AnomalyType,
} from '@/types';
import { calculateBatchLosses, computeStats } from '@/utils/calculations';
import { detectAnomalies, groupAnomaliesByType } from '@/utils/validation';
import { getDefaultFilter } from '@/utils/export';

interface FiberStore {
  records: MeasurementRecord[];
  results: CalculationResult[];
  anomalies: Anomaly[];
  history: HistoryEntry[];
  filter: FilterState;

  addRecord: (record: MeasurementRecord) => void;
  addRecords: (records: MeasurementRecord[]) => void;
  updateRecord: (id: string, updates: Partial<MeasurementRecord>) => void;
  deleteRecord: (id: string) => void;

  runCalculation: () => void;

  undoTo: (historyId: string) => void;
  supplementRecord: (record: MeasurementRecord) => void;

  setFilter: (filter: Partial<FilterState>) => void;
  resetFilter: () => void;

  getFilteredRecords: () => MeasurementRecord[];
  getFilteredResults: () => CalculationResult[];
  getFilteredAnomalies: () => Anomaly[];
  getGroupedAnomalies: () => Record<AnomalyType, Anomaly[]>;
  getStats: () => { avg: number; max: number; min: number; count: number; anomalyRate: number };

  loadDemoData: () => void;
}

function snapshotRecords(records: MeasurementRecord[]): string {
  return JSON.stringify(records.map((r) => ({ id: r.id, len: r.fiberLength, pin: r.inputPower, pout: r.outputPower })));
}

function createHistoryEntry(action: HistoryEntry['action'], summary: string, before: string, after: string): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    action,
    summary,
    beforeSnapshot: before,
    afterSnapshot: after,
    timestamp: new Date().toISOString(),
  };
}

export const useFiberStore = create<FiberStore>()(
  persist(
    (set, get) => ({
      records: [],
      results: [],
      anomalies: [],
      history: [],
      filter: getDefaultFilter(),

      addRecord: (record) => {
        const before = snapshotRecords(get().records);
        const newRecords = [...get().records, record];
        const after = snapshotRecords(newRecords);
        const entry = createHistoryEntry('supplement', `添加记录 ${record.id.slice(0, 8)}`, before, after);
        set({ records: newRecords, history: [...get().history, entry] });
      },

      addRecords: (records) => {
        const before = snapshotRecords(get().records);
        const newRecords = [...get().records, ...records];
        const after = snapshotRecords(newRecords);
        const entry = createHistoryEntry('supplement', `批量添加 ${records.length} 条记录`, before, after);
        set({ records: newRecords, history: [...get().history, entry] });
      },

      updateRecord: (id, updates) => {
        const before = snapshotRecords(get().records);
        const newRecords = get().records.map((r) => (r.id === id ? { ...r, ...updates } : r));
        const after = snapshotRecords(newRecords);
        const entry = createHistoryEntry('modify', `修改记录 ${id.slice(0, 8)}`, before, after);
        set({ records: newRecords, history: [...get().history, entry] });
      },

      deleteRecord: (id) => {
        const before = snapshotRecords(get().records);
        const newRecords = get().records.filter((r) => r.id !== id);
        const after = snapshotRecords(newRecords);
        const entry = createHistoryEntry('delete', `删除记录 ${id.slice(0, 8)}`, before, after);
        set({
          records: newRecords,
          results: get().results.filter((r) => r.recordId !== id),
          anomalies: get().anomalies.filter((a) => a.recordId !== id),
          history: [...get().history, entry],
        });
      },

      runCalculation: () => {
        const { records } = get();
        const before = snapshotRecords(records);
        const results = calculateBatchLosses(records);
        const anomalies = detectAnomalies(records);
        const after = snapshotRecords(records);
        const entry = createHistoryEntry(
          'calculate',
          `计算 ${records.length} 条记录的损耗，发现 ${anomalies.length} 个异常`,
          before,
          after
        );
        set({
          results,
          anomalies,
          history: [...get().history, entry],
        });
      },

      undoTo: (historyId) => {
        const { history } = get();
        const idx = history.findIndex((h) => h.id === historyId);
        if (idx < 0) return;
        const targetEntry = history[idx];
        try {
          const restored = JSON.parse(targetEntry.beforeSnapshot);
          const mapped: MeasurementRecord[] = get().records.filter((r) =>
            restored.some((s: { id: string }) => s.id === r.id)
          );
          const before = snapshotRecords(get().records);
          const after = snapshotRecords(mapped);
          const entry = createHistoryEntry('undo', `撤回到 ${targetEntry.timestamp.slice(0, 19)}`, before, after);
          const results = calculateBatchLosses(mapped);
          const anomalies = detectAnomalies(mapped);
          set({
            records: mapped,
            results,
            anomalies,
            history: [...get().history, entry],
          });
        } catch {
          // ignore parse errors
        }
      },

      supplementRecord: (record) => {
        const before = snapshotRecords(get().records);
        const newRecords = [...get().records, record];
        const after = snapshotRecords(newRecords);
        const results = calculateBatchLosses(newRecords);
        const anomalies = detectAnomalies(newRecords);
        const entry = createHistoryEntry('supplement', `补录记录 ${record.id.slice(0, 8)}`, before, after);
        set({
          records: newRecords,
          results,
          anomalies,
          history: [...get().history, entry],
        });
      },

      setFilter: (partial) => {
        set({ filter: { ...get().filter, ...partial } });
      },

      resetFilter: () => {
        set({ filter: getDefaultFilter() });
      },

      getFilteredRecords: () => {
        const { records, anomalies, filter } = get();
        const anomalyRecordIds = new Set(
          anomalies.filter((a) => filter.anomalyTypes.length > 0 && filter.anomalyTypes.includes(a.type)).map((a) => a.recordId)
        );
        return records.filter((r) => {
          if (r.wavelength < filter.wavelengthRange[0] || r.wavelength > filter.wavelengthRange[1]) return false;
          if (r.fiberLength < filter.lengthRange[0] || r.fiberLength > filter.lengthRange[1]) return false;
          if (filter.dataSource.length > 0 && !filter.dataSource.includes(r.dataSource)) return false;
          if (filter.anomalyTypes.length > 0 && !anomalyRecordIds.has(r.id)) return false;
          return true;
        });
      },

      getFilteredResults: () => {
        const filtered = get().getFilteredRecords();
        const ids = new Set(filtered.map((r) => r.id));
        return get().results.filter((r) => ids.has(r.recordId));
      },

      getFilteredAnomalies: () => {
        const filtered = get().getFilteredRecords();
        const ids = new Set(filtered.map((r) => r.id));
        return get().anomalies.filter((a) => ids.has(a.recordId));
      },

      getGroupedAnomalies: () => {
        return groupAnomaliesByType(get().getFilteredAnomalies());
      },

      getStats: () => {
        return computeStats(get().getFilteredResults());
      },

      loadDemoData: () => {
        const demoRecords: MeasurementRecord[] = [
          {
            id: crypto.randomUUID(), fiberLength: 10, lengthUnit: 'km', inputPower: 0, outputPower: -5.2,
            powerUnit: 'dBm', wavelength: 1310, wavelengthUnit: 'nm', connectorCount: 2,
            connectorIds: ['J01', 'J02'], dataSource: 'system', notes: '标准单模光纤', createdAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(), fiberLength: 5, lengthUnit: 'km', inputPower: 10, outputPower: 3,
            powerUnit: 'mW', wavelength: 1550, wavelengthUnit: 'nm', connectorCount: 1,
            connectorIds: ['J01'], dataSource: 'manual', notes: '功率用mW记录，需转换', createdAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(), fiberLength: 0, lengthUnit: 'km', inputPower: -2, outputPower: -8.5,
            powerUnit: 'dBm', wavelength: 1310, wavelengthUnit: 'nm', connectorCount: 3,
            connectorIds: ['J03', 'J04', 'J05'], dataSource: 'system', notes: '长度漏填', createdAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(), fiberLength: 8, lengthUnit: 'km', inputPower: -1, outputPower: -7.8,
            powerUnit: 'dBm', wavelength: 1550, wavelengthUnit: 'nm', connectorCount: 2,
            connectorIds: ['J06', 'J07'], dataSource: 'system', notes: '', createdAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(), fiberLength: 3, lengthUnit: 'km', inputPower: 5, outputPower: 2,
            powerUnit: 'mW', wavelength: 850, wavelengthUnit: 'nm', connectorCount: 1,
            connectorIds: ['J03'], dataSource: 'manual', notes: '多模光纤，接头J03与3号记录重复', createdAt: new Date().toISOString(),
          },
        ];
        const before = snapshotRecords(get().records);
        const after = snapshotRecords(demoRecords);
        const entry = createHistoryEntry('supplement', `载入 ${demoRecords.length} 条示例数据`, before, after);
        const results = calculateBatchLosses(demoRecords);
        const anomalies = detectAnomalies(demoRecords);
        set({
          records: demoRecords,
          results,
          anomalies,
          history: [...get().history, entry],
        });
      },
    }),
    {
      name: 'fiber-loss-store',
      partialize: (state) => ({
        records: state.records,
        results: state.results,
        anomalies: state.anomalies,
        history: state.history,
      }),
    }
  )
);
