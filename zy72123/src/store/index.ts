import { create } from 'zustand';
import { db } from '@/db';
import type {
  SensorBatch,
  SensorRecord,
  FieldNote,
  ManualCorrection,
  ParamVersion,
  EstimationRun,
  EstimationResult,
  AnomalyRecord,
  ConflictRecord,
  DirtyDataRecord,
  ParamValues,
} from '@/types';
import {
  sampleBatch,
  sampleSensorRecords,
  sampleFieldNotes,
  sampleManualCorrections,
  sampleParamVersionV1,
  sampleParamVersionV2,
  buildSampleDirtyData,
} from '@/data/sampleData';
import { estimateRegenBraking, detectConflicts } from '@/engine/estimation';

function uid(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

interface AppState {
  sensorBatches: SensorBatch[];
  currentBatchId: string | null;
  sensorRecords: SensorRecord[];
  fieldNotes: FieldNote[];
  manualCorrections: ManualCorrection[];
  paramVersions: ParamVersion[];
  currentParamVersionId: string | null;
  estimationRuns: EstimationRun[];
  currentRunId: string | null;
  estimationResults: EstimationResult[];
  anomalyRecords: AnomalyRecord[];
  conflictRecords: ConflictRecord[];
  dirtyDataRecords: DirtyDataRecord[];
  loading: boolean;

  loadSampleData: () => Promise<void>;
  loadAllData: () => Promise<void>;
  setCurrentBatch: (batchId: string) => Promise<void>;
  setCurrentParamVersion: (versionId: string) => void;
  updateParamVersion: (versionId: string, values: ParamValues, note: string, changedBy: string) => Promise<ParamVersion>;
  runEstimation: () => Promise<void>;
  resolveDirtyData: (dirtyId: string, resolution: string) => Promise<void>;
  resolveConflict: (conflictId: string, decision: string, reason: string) => Promise<void>;
  addFieldNote: (note: Omit<FieldNote, 'id'>) => Promise<void>;
  addManualCorrection: (correction: Omit<ManualCorrection, 'id'>) => Promise<void>;
  importSensorRecords: (records: Omit<SensorRecord, 'id'>[], batchName: string) => Promise<string>;
  deleteBatch: (batchId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  sensorBatches: [],
  currentBatchId: null,
  sensorRecords: [],
  fieldNotes: [],
  manualCorrections: [],
  paramVersions: [],
  currentParamVersionId: null,
  estimationRuns: [],
  currentRunId: null,
  estimationResults: [],
  anomalyRecords: [],
  conflictRecords: [],
  dirtyDataRecords: [],
  loading: false,

  loadSampleData: async () => {
    set({ loading: true });
    try {
      await db.sensorBatches.put(sampleBatch);
      await db.sensorRecords.bulkPut(sampleSensorRecords);
      await db.fieldNotes.bulkPut(sampleFieldNotes);
      await db.manualCorrections.bulkPut(sampleManualCorrections);
      await db.paramVersions.bulkPut([sampleParamVersionV1, sampleParamVersionV2]);

      const dirtyData = buildSampleDirtyData(sampleSensorRecords, sampleBatch.id);
      await db.dirtyDataRecords.bulkPut(dirtyData);

      set({
        sensorBatches: [sampleBatch],
        currentBatchId: sampleBatch.id,
        sensorRecords: sampleSensorRecords,
        fieldNotes: sampleFieldNotes,
        manualCorrections: sampleManualCorrections,
        paramVersions: [sampleParamVersionV1, sampleParamVersionV2],
        currentParamVersionId: sampleParamVersionV2.id,
        dirtyDataRecords: dirtyData,
      });
    } finally {
      set({ loading: false });
    }
  },

  loadAllData: async () => {
    set({ loading: true });
    try {
      const batches = await db.sensorBatches.toArray();
      const versions = await db.paramVersions.toArray();
      const runs = await db.estimationRuns.toArray();

      let currentBatchId = batches.length > 0 ? batches[0].id : null;
      let sensorRecords: SensorRecord[] = [];
      let fieldNotes: FieldNote[] = [];
      let manualCorrections: ManualCorrection[] = [];
      let dirtyDataRecords: DirtyDataRecord[] = [];

      if (currentBatchId) {
        sensorRecords = await db.sensorRecords.where('batchId').equals(currentBatchId).toArray();
        fieldNotes = await db.fieldNotes.where('batchId').equals(currentBatchId).toArray();
        manualCorrections = await db.manualCorrections.where('batchId').equals(currentBatchId).toArray();
        dirtyDataRecords = await db.dirtyDataRecords.where('batchId').equals(currentBatchId).toArray();
      }

      let currentParamVersionId = versions.length > 0 ? versions[versions.length - 1].id : null;
      let currentRunId = runs.length > 0 ? runs[runs.length - 1].id : null;
      let estimationResults: EstimationResult[] = [];
      let anomalyRecords: AnomalyRecord[] = [];
      let conflictRecords: ConflictRecord[] = [];

      if (currentRunId) {
        estimationResults = await db.estimationResults.where('runId').equals(currentRunId).toArray();
        anomalyRecords = await db.anomalyRecords.where('runId').equals(currentRunId).toArray();
        conflictRecords = await db.conflictRecords.where('runId').equals(currentRunId).toArray();
      }

      set({
        sensorBatches: batches,
        currentBatchId,
        sensorRecords,
        fieldNotes,
        manualCorrections,
        paramVersions: versions,
        currentParamVersionId,
        estimationRuns: runs,
        currentRunId,
        estimationResults,
        anomalyRecords,
        conflictRecords,
        dirtyDataRecords,
      });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentBatch: async (batchId: string) => {
    const sensorRecords = await db.sensorRecords.where('batchId').equals(batchId).toArray();
    const fieldNotes = await db.fieldNotes.where('batchId').equals(batchId).toArray();
    const manualCorrections = await db.manualCorrections.where('batchId').equals(batchId).toArray();
    const dirtyDataRecords = await db.dirtyDataRecords.where('batchId').equals(batchId).toArray();
    set({
      currentBatchId: batchId,
      sensorRecords,
      fieldNotes,
      manualCorrections,
      dirtyDataRecords,
    });
  },

  setCurrentParamVersion: (versionId: string) => {
    set({ currentParamVersionId: versionId });
  },

  updateParamVersion: async (versionId: string, values: ParamValues, note: string, changedBy: string) => {
    const existing = await db.paramVersions.get(versionId);
    if (!existing) throw new Error('参数版本不存在');

    const newVersion: ParamVersion = {
      id: `pv-${uid()}`,
      paramId: existing.paramId,
      versionNumber: existing.versionNumber + 1,
      values,
      changedBy,
      changedAt: new Date().toISOString(),
      changeNote: note,
    };

    await db.paramVersions.put(newVersion);

    const allVersions = await db.paramVersions.toArray();
    set({
      paramVersions: allVersions,
      currentParamVersionId: newVersion.id,
    });

    return newVersion;
  },

  runEstimation: async () => {
    const { currentBatchId, currentParamVersionId, sensorRecords, fieldNotes } = get();
    if (!currentBatchId || !currentParamVersionId) return;

    const paramVersion = await db.paramVersions.get(currentParamVersionId);
    if (!paramVersion) return;

    const runId = `run-${uid()}`;
    const run: EstimationRun = {
      id: runId,
      batchId: currentBatchId,
      paramVersionId: currentParamVersionId,
      runTime: new Date().toISOString(),
      status: 'running',
    };

    await db.estimationRuns.put(run);
    set({ currentRunId: runId, estimationRuns: [...get().estimationRuns, run] });

    try {
      const { results, anomalies } = estimateRegenBraking(sensorRecords, paramVersion.values, runId);
      const conflicts = detectConflicts(sensorRecords, fieldNotes, runId);

      await db.estimationResults.bulkPut(results);
      await db.anomalyRecords.bulkPut(anomalies);
      await db.conflictRecords.bulkPut(conflicts);

      run.status = 'completed';
      await db.estimationRuns.put(run);

      set({
        estimationResults: results,
        anomalyRecords: anomalies,
        conflictRecords: conflicts,
        estimationRuns: get().estimationRuns.map((r) => r.id === runId ? { ...r, status: 'completed' as const } : r),
      });
    } catch {
      run.status = 'error';
      await db.estimationRuns.put(run);
      set({
        estimationRuns: get().estimationRuns.map((r) => r.id === runId ? { ...r, status: 'error' as const } : r),
      });
    }
  },

  resolveDirtyData: async (dirtyId: string, resolution: string) => {
    await db.dirtyDataRecords.update(dirtyId, { resolution });
    set({
      dirtyDataRecords: get().dirtyDataRecords.map((d) =>
        d.id === dirtyId ? { ...d, resolution } : d
      ),
    });
  },

  resolveConflict: async (conflictId: string, decision: string, reason: string) => {
    const update = { userDecision: decision, decisionReason: reason, decisionTime: new Date().toISOString() };
    await db.conflictRecords.update(conflictId, update);
    set({
      conflictRecords: get().conflictRecords.map((c) =>
        c.id === conflictId ? { ...c, ...update } : c
      ),
    });
  },

  addFieldNote: async (note: Omit<FieldNote, 'id'>) => {
    const newNote: FieldNote = { ...note, id: `fn-${uid()}` };
    await db.fieldNotes.put(newNote);
    set({ fieldNotes: [...get().fieldNotes, newNote] });
  },

  addManualCorrection: async (correction: Omit<ManualCorrection, 'id'>) => {
    const newCorrection: ManualCorrection = { ...correction, id: `mc-${uid()}` };
    await db.manualCorrections.put(newCorrection);

    const records = get().sensorRecords.map((r) =>
      r.id === correction.recordId
        ? { ...r, status: 'corrected' as const, [correction.field]: correction.newValue }
        : r
    );
    await db.sensorRecords.bulkPut(records);

    set({
      manualCorrections: [...get().manualCorrections, newCorrection],
      sensorRecords: records,
    });
  },

  importSensorRecords: async (records: Omit<SensorRecord, 'id'>[], batchName: string) => {
    const batchId = `batch-${uid()}`;
    const batch: SensorBatch = {
      id: batchId,
      name: batchName,
      importTime: new Date().toISOString(),
      source: 'CSV/JSON导入',
      recordCount: records.length,
    };

    const fullRecords: SensorRecord[] = records.map((r, i) => ({
      ...r,
      id: `${batchId}-rec-${i + 1}`,
      batchId,
    }));

    await db.sensorBatches.put(batch);
    await db.sensorRecords.bulkPut(fullRecords);

    const dirtyData = buildSampleDirtyData(fullRecords, batchId);
    await db.dirtyDataRecords.bulkPut(dirtyData);

    set({
      sensorBatches: [...get().sensorBatches, batch],
      currentBatchId: batchId,
      sensorRecords: fullRecords,
      dirtyDataRecords: dirtyData,
    });

    return batchId;
  },

  deleteBatch: async (batchId: string) => {
    await db.sensorRecords.where('batchId').equals(batchId).delete();
    await db.fieldNotes.where('batchId').equals(batchId).delete();
    await db.manualCorrections.where('batchId').equals(batchId).delete();
    await db.dirtyDataRecords.where('batchId').equals(batchId).delete();
    await db.sensorBatches.delete(batchId);

    const batches = await db.sensorBatches.toArray();
    set({
      sensorBatches: batches,
      currentBatchId: batches.length > 0 ? batches[0].id : null,
    });
  },
}));
