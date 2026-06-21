import { create } from 'zustand';
import type {
  Batch,
  CalculationRecord,
  Sample,
  ParamVersion,
  Remark,
  ImportResult,
} from '@/types';
import {
  mockBatch,
  mockCalculationRecords,
  mockSamples,
  mockParamVersions,
  mockRemarks,
} from '@/data/mockData';
import { calculationEngine } from '@/engine/CalculationEngine';
import { materialPackageParser } from '@/engine/MaterialPackageParser';

const STORAGE_KEY = 'gnn-community-explainer-store';

interface PersistedState {
  remarks: Remark[];
  calculationRecords: CalculationRecord[];
  samples: Sample[];
  batches: Batch[];
  paramVersions: ParamVersion[];
  currentBatchId: string | null;
  selectedRecordId: string | null;
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const persisted = loadPersistedState();

interface AppState {
  batches: Batch[];
  currentBatchId: string | null;
  calculationRecords: CalculationRecord[];
  samples: Sample[];
  paramVersions: ParamVersion[];
  remarks: Remark[];
  selectedRecordId: string | null;
  isLoading: boolean;

  getCurrentBatch: () => Batch | undefined;
  getCurrentRecords: () => CalculationRecord[];
  getCurrentSamples: () => Sample[];
  getRecordRemarks: (recordId: string) => Remark[];

  setCurrentBatch: (batchId: string) => void;
  selectRecord: (recordId: string | null) => void;
  addRemark: (recordId: string, content: string, addedBy: string) => void;
  runCalculation: () => Promise<void>;
  recalculateRecord: (recordId: string) => void;
  resetToDefaults: () => void;

  importMaterialPackage: (jsonText: string) => { result: ImportResult | null; errors: string[]; warnings: string[] };
}

function getPersistableState(state: AppState): PersistedState {
  return {
    remarks: state.remarks,
    calculationRecords: state.calculationRecords,
    samples: state.samples,
    batches: state.batches,
    paramVersions: state.paramVersions,
    currentBatchId: state.currentBatchId,
    selectedRecordId: state.selectedRecordId,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  batches: persisted?.batches ?? [mockBatch],
  currentBatchId: persisted?.currentBatchId ?? mockBatch.id,
  calculationRecords: persisted?.calculationRecords ?? mockCalculationRecords,
  samples: persisted?.samples ?? mockSamples,
  paramVersions: persisted?.paramVersions ?? mockParamVersions,
  remarks: persisted?.remarks ?? mockRemarks,
  selectedRecordId: persisted?.selectedRecordId ?? null,
  isLoading: false,

  getCurrentBatch: () => {
    const { batches, currentBatchId } = get();
    return batches.find((b) => b.id === currentBatchId);
  },

  getCurrentRecords: () => {
    const { calculationRecords, currentBatchId } = get();
    return calculationRecords.filter((r) => r.batchId === currentBatchId);
  },

  getCurrentSamples: () => {
    const { samples, currentBatchId } = get();
    return samples.filter((s) => s.batchId === currentBatchId);
  },

  getRecordRemarks: (recordId: string) => {
    const { remarks } = get();
    return remarks.filter((r) => r.recordId === recordId);
  },

  setCurrentBatch: (batchId: string) => {
    set((state) => {
      const updated = { currentBatchId: batchId };
      savePersistedState({ ...getPersistableState(state), ...updated });
      return updated;
    });
  },

  selectRecord: (recordId: string | null) => {
    set((state) => {
      const updated = { selectedRecordId: recordId };
      savePersistedState({ ...getPersistableState(state), ...updated });
      return updated;
    });
  },

  addRemark: (recordId: string, content: string, addedBy: string) => {
    const newRemark: Remark = {
      id: 'remark-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      recordId,
      content,
      addedBy,
      addedAt: new Date().toISOString(),
      isSupplement: true,
    };
    set((state) => {
      const updated = { remarks: [...state.remarks, newRemark] };
      savePersistedState({ ...getPersistableState(state), ...updated });
      return updated;
    });
  },

  runCalculation: async () => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const { samples, calculationRecords, currentBatchId } = get();
    const currentSamples = samples.filter((s) => s.batchId === currentBatchId);

    const otherBatchRecords = calculationRecords.filter((r) => r.batchId !== currentBatchId);
    const existingLegacyRecords = calculationRecords.filter(
      (r) => r.batchId === currentBatchId && r.type === 'legacy'
    );

    const recalculatedRecords: CalculationRecord[] = [];
    let successCount = 0;
    let pendingCount = 0;
    const legacyCount = existingLegacyRecords.length;

    for (const sample of currentSamples) {
      if (sample.status === 'legacy') continue;

      const raw = sample.rawInput;
      const hasRawInput =
        raw !== undefined &&
        (raw.nodeCount !== undefined || raw.edgeCount !== undefined || raw.avgDegree !== undefined);

      const input = {
        nodeCount: hasRawInput ? raw.nodeCount : 15 + Math.floor(Math.random() * 10),
        edgeCount: hasRawInput ? raw.edgeCount : 40 + Math.floor(Math.random() * 20),
        sampleId: sample.id,
        sampleName: sample.name,
        batchId: currentBatchId || '',
        avgDegree: hasRawInput ? (raw.avgDegree ?? undefined) : 5 + Math.random() * 2,
      };

      const result = calculationEngine.calculate(input);
      recalculatedRecords.push(result.record);

      if (result.type === 'success') {
        successCount++;
      } else {
        pendingCount++;
      }
    }

    const newRecordsForCurrentBatch = [...existingLegacyRecords, ...recalculatedRecords];

    set((state) => {
      const updatedBatches = state.batches.map((b) =>
        b.id === currentBatchId
          ? {
              ...b,
              status: 'completed' as const,
              successCount,
              pendingCount,
              legacyCount,
              errorCount: currentSamples.length - successCount - pendingCount - legacyCount,
              completedAt: new Date().toISOString(),
            }
          : b
      );
      const updated = {
        calculationRecords: [...otherBatchRecords, ...newRecordsForCurrentBatch],
        isLoading: false,
        batches: updatedBatches,
      };
      savePersistedState({ ...getPersistableState(state), ...updated });
      return updated;
    });
  },

  recalculateRecord: (recordId: string) => {
    const record = get().calculationRecords.find((r) => r.id === recordId);
    if (!record) return;

    const sample = get().samples.find((s) => s.id === record.sampleId);
    const raw = sample?.rawInput;
    const hasRaw =
      raw &&
      (raw.nodeCount !== undefined || raw.edgeCount !== undefined || raw.avgDegree !== undefined);

    const result = calculationEngine.calculate({
      nodeCount: hasRaw ? raw!.nodeCount : record.inputData.nodeCount ?? null,
      edgeCount: hasRaw ? raw!.edgeCount : record.inputData.edgeCount ?? null,
      sampleId: record.sampleId,
      sampleName: record.sampleName,
      batchId: record.batchId,
      avgDegree: hasRaw ? (raw!.avgDegree ?? undefined) : (record.inputData.avgDegree as number | undefined),
    });

    set((state) => {
      const updated = {
        calculationRecords: state.calculationRecords.map((r) =>
          r.id === recordId ? { ...result.record, id: recordId } : r
        ),
      };
      savePersistedState({ ...getPersistableState(state), ...updated });
      return updated;
    });
  },

  importMaterialPackage: (jsonText: string) => {
    const parsed = materialPackageParser.parse(jsonText);
    if (!parsed.package) {
      return { result: null, errors: parsed.errors, warnings: parsed.warnings };
    }

    const processed = materialPackageParser.processMaterialPackage(parsed.package);
    const result = materialPackageParser.toImportResult(parsed.package, processed);

    set((state) => {
      const newParamVersions = processed.paramVersion
        ? [...state.paramVersions, processed.paramVersion]
        : state.paramVersions;

      const updated = {
        batches: [...state.batches, processed.batch],
        currentBatchId: processed.batch.id,
        samples: [...state.samples, ...processed.samples],
        calculationRecords: [...state.calculationRecords, ...processed.records],
        remarks: [...state.remarks, ...processed.remarks],
        paramVersions: newParamVersions,
        selectedRecordId: null,
      };
      savePersistedState({ ...getPersistableState(state), ...updated });
      return updated;
    });

    return { result, errors: [], warnings: parsed.warnings };
  },

  resetToDefaults: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      batches: [mockBatch],
      currentBatchId: mockBatch.id,
      calculationRecords: mockCalculationRecords,
      samples: mockSamples,
      paramVersions: mockParamVersions,
      remarks: mockRemarks,
      selectedRecordId: null,
      isLoading: false,
    });
  },
}));
