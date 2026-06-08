import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  InspectionRecord,
  CalculationParams,
  ThresholdVersion,
  HeatLossResult,
  CalculationBatch,
  Note,
} from '../types';
import { MOCK_RECORDS, INITIAL_THRESHOLDS, DEFAULT_CALC_PARAMS } from '../data/mockData';
import { calculateHeatLoss } from '../utils/heatLossCalc';
import { checkRecordQuality, classifyDataQuality } from '../utils/dataQuality';

interface AppState {
  records: InspectionRecord[];
  params: CalculationParams;
  thresholds: ThresholdVersion[];
  activeThresholdId: string;
  results: HeatLossResult[];
  batches: CalculationBatch[];
  currentBatchId: string | null;
  notes: Note[];

  setRecords: (records: InspectionRecord[]) => void;
  addRecord: (record: InspectionRecord) => void;
  updateRecord: (id: string, updates: Partial<InspectionRecord>) => void;
  removeRecord: (id: string) => void;

  setParams: (params: CalculationParams) => void;

  addThreshold: (threshold: Omit<ThresholdVersion, 'id' | 'createdAt' | 'createdBy' | 'isActive'>) => void;
  setActiveThreshold: (id: string) => void;

  calculateResults: () => void;
  loadBatch: (batchId: string) => void;
  compareBatches: (batchIdA: string, batchIdB: string) => {
    batchA: CalculationBatch | undefined;
    batchB: CalculationBatch | undefined;
    resultsA: HeatLossResult[];
    resultsB: HeatLossResult[];
  } | null;

  addNote: (recordId: string, content: string) => void;
  getNotesForRecord: (recordId: string) => Note[];

  resetToDemo: () => void;
  clearAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      records: [...MOCK_RECORDS],
      params: { ...DEFAULT_CALC_PARAMS },
      thresholds: [...INITIAL_THRESHOLDS],
      activeThresholdId: INITIAL_THRESHOLDS.find(t => t.isActive)?.id || INITIAL_THRESHOLDS[0].id,
      results: [],
      batches: [],
      currentBatchId: null,
      notes: [],

      setRecords: (records) => {
        const processedRecords = records.map(r => {
          const issues = checkRecordQuality(r);
          return {
            ...r,
            dataQuality: classifyDataQuality(issues),
            dataIssues: issues.map(i => i.message),
          };
        });
        set({ records: processedRecords });
      },

      addRecord: (record) => {
        const issues = checkRecordQuality(record);
        const processedRecord = {
          ...record,
          dataQuality: classifyDataQuality(issues),
          dataIssues: issues.map(i => i.message),
        };
        set(state => ({ records: [...state.records, processedRecord] }));
      },

      updateRecord: (id, updates) => {
        set(state => {
          const records = state.records.map(r => {
            if (r.id === id) {
              const updated = { ...r, ...updates };
              const issues = checkRecordQuality(updated);
              return {
                ...updated,
                dataQuality: classifyDataQuality(issues),
                dataIssues: issues.map(i => i.message),
              };
            }
            return r;
          });
          return { records };
        });
      },

      removeRecord: (id) => {
        set(state => ({
          records: state.records.filter(r => r.id !== id),
        }));
      },

      setParams: (params) => {
        set({ params });
      },

      addThreshold: (threshold) => {
        const newThreshold: ThresholdVersion = {
          ...threshold,
          id: `thresh_${Date.now()}`,
          createdAt: new Date().toISOString(),
          createdBy: '何工',
          isActive: true,
        };
        set(state => ({
          thresholds: state.thresholds.map(t => ({ ...t, isActive: false })).concat(newThreshold),
          activeThresholdId: newThreshold.id,
        }));
      },

      setActiveThreshold: (id) => {
        set(state => ({
          thresholds: state.thresholds.map(t => ({ ...t, isActive: t.id === id })),
          activeThresholdId: id,
        }));
      },

      calculateResults: () => {
        const { records, params, thresholds, activeThresholdId } = get();
        const threshold = thresholds.find(t => t.id === activeThresholdId);
        if (!threshold) return;

        const batchId = `batch_${Date.now()}`;
        
        const newResults = records
          .map(r => calculateHeatLoss(r, params, threshold, batchId))
          .filter((r): r is HeatLossResult => r !== null);

        const newBatch: CalculationBatch = {
          id: batchId,
          name: `批次-${new Date().toLocaleDateString('zh-CN')} ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
          createdAt: new Date().toISOString(),
          createdBy: '何工',
          paramsSnapshot: { ...params },
          thresholdVersionId: threshold.id,
          recordCount: records.length,
          notes: [],
        };
        set(state => ({
          results: [...state.results, ...newResults],
          batches: [...state.batches, newBatch],
          currentBatchId: batchId,
        }));
      },

      loadBatch: (batchId) => {
        const { batches, thresholds } = get();
        const batch = batches.find(b => b.id === batchId);
        if (!batch) return;

        const threshold = thresholds.find(t => t.id === batch.thresholdVersionId);
        
        if (threshold) {
          set({
            currentBatchId: batchId,
            params: { ...batch.paramsSnapshot },
            activeThresholdId: threshold.id,
          });
        }
      },

      compareBatches: (batchIdA, batchIdB) => {
        const { batches, results } = get();
        const batchA = batches.find(b => b.id === batchIdA);
        const batchB = batches.find(b => b.id === batchIdB);
        
        if (!batchA || !batchB) return null;

        return {
          batchA,
          batchB,
          resultsA: results.filter(r => r.batchId === batchIdA),
          resultsB: results.filter(r => r.batchId === batchIdB),
        };
      },

      addNote: (recordId, content) => {
        const { currentBatchId } = get();
        const newNote: Note = {
          id: `note_${Date.now()}`,
          batchId: currentBatchId || '',
          recordId,
          content,
          createdAt: new Date().toISOString(),
          createdBy: '何工',
        };
        set(state => ({
          notes: [...state.notes, newNote],
        }));
      },

      getNotesForRecord: (recordId) => {
        const { notes, currentBatchId } = get();
        return notes.filter(n => n.recordId === recordId && n.batchId === currentBatchId);
      },

      resetToDemo: () => {
        set({
          records: [...MOCK_RECORDS],
          params: { ...DEFAULT_CALC_PARAMS },
          thresholds: [...INITIAL_THRESHOLDS],
          activeThresholdId: INITIAL_THRESHOLDS.find(t => t.isActive)?.id || INITIAL_THRESHOLDS[0].id,
          results: [],
          batches: [],
          currentBatchId: null,
          notes: [],
        });
      },

      clearAll: () => {
        set({
          records: [],
          params: { ...DEFAULT_CALC_PARAMS },
          results: [],
          currentBatchId: null,
          notes: [],
        });
      },
    }),
    {
      name: 'cold-storage-calculator',
      version: 1,
    }
  )
);
