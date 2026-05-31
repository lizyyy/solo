import { create } from 'zustand';
import type {
  AnalysisRun,
  Batch,
  Material,
  PressureDataPoint,
  AnalysisConclusion,
  DataSource,
  ShiftRecord,
  WorkLog,
  MaintenanceOrder,
  SourceStats,
  User,
} from '@/types';
import {
  getAllFromStore,
  getFromStore,
  addToStore,
  getAnalysisRunsByBatchId,
  getNextAnalysisVersion,
  getShiftRecordsByTimeRange,
  getWorkLogVersions,
} from '@/utils/db';
import {
  detectCrossThresholds,
  alignDataByTime,
  extractPressureFromShiftRecord,
  extractPressureFromWorkLog,
  generateConclusions,
  createDataSource,
  generateOverallResult,
} from '@/utils/pulseAnalysis';
import { generateId } from '@/utils/helpers';

interface AnalysisState {
  batches: Batch[];
  materials: Material[];
  analysisRuns: AnalysisRun[];
  currentRun: AnalysisRun | null;
  currentConclusions: AnalysisConclusion[];
  currentAnalysis: AnalysisRun | null;
  loading: boolean;
  error: string | null;

  loadBatches: () => Promise<void>;
  loadMaterials: () => Promise<void>;
  loadAnalysisRuns: (batchId: string) => Promise<void>;
  loadCurrentAnalysis: (analysisId: string) => Promise<void>;
  createBatch: (materialId: string) => Promise<string>;
  createMaterial: (data: Omit<Material, 'id' | 'createdAt'>) => Promise<string>;
  runPulseAnalysis: (batchId: string, user: User) => Promise<AnalysisRun | null>;
  selectAnalysisRun: (run: AnalysisRun) => void;
  setCurrentAnalysis: (analysis: AnalysisRun | null) => void;
  clearError: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  batches: [],
  materials: [],
  analysisRuns: [],
  currentRun: null,
  currentConclusions: [],
  currentAnalysis: null,
  loading: false,
  error: null,

  loadBatches: async () => {
    set({ loading: true });
    try {
      const batches = await getAllFromStore('batches');
      const materials = await getAllFromStore('materials');
      const batchesWithMaterial = batches.map((batch) => ({
        ...batch,
        material: materials.find((m) => m.id === batch.materialId),
      }));
      set({ batches: batchesWithMaterial, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadMaterials: async () => {
    set({ loading: true });
    try {
      const materials = await getAllFromStore('materials');
      set({ materials, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadAnalysisRuns: async (batchId: string) => {
    set({ loading: true });
    try {
      const runs = await getAnalysisRunsByBatchId(batchId);
      const batches = get().batches;
      const materials = get().materials;
      const runsWithBatch = runs.map((run) => ({
        ...run,
        batch: {
          ...batches.find((b) => b.id === run.batchId)!,
          material: materials.find((m) => m.id === batches.find((b) => b.id === run.batchId)?.materialId),
        },
      }));
      set({
        analysisRuns: runsWithBatch,
        currentRun: runsWithBatch[0] || null,
        currentConclusions: runsWithBatch[0]?.conclusions || [],
        loading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadCurrentAnalysis: async (analysisId: string) => {
    set({ loading: true });
    try {
      const analysis = await getFromStore('analysisRuns', analysisId);
      if (analysis) {
        const batches = get().batches;
        const materials = get().materials;
        const analysisWithBatch = {
          ...analysis,
          batch: {
            ...batches.find((b) => b.id === analysis.batchId)!,
            material: materials.find((m) => m.id === batches.find((b) => b.id === analysis.batchId)?.materialId),
          },
        };
        set({
          currentAnalysis: analysisWithBatch,
          currentRun: analysisWithBatch,
          currentConclusions: analysisWithBatch.conclusions,
          loading: false,
        });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createBatch: async (materialId: string) => {
    const batch: Batch = {
      id: generateId('batch'),
      materialId,
      status: 'active',
      startTime: Date.now(),
    };
    return addToStore('batches', batch);
  },

  createMaterial: async (data) => {
    const material: Material = {
      ...data,
      id: generateId('mat'),
    };
    return addToStore('materials', material);
  },

  runPulseAnalysis: async (batchId, user) => {
    set({ loading: true, error: null });
    const startTime = Date.now();
    try {
      const version = await getNextAnalysisVersion(batchId);

      const batches = get().batches;
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) {
        throw new Error('Batch not found');
      }

      const timeRangeStart = batch.startTime;
      const timeRangeEnd = batch.endTime || Date.now();

      const shiftRecords = await getShiftRecordsByTimeRange(timeRangeStart, timeRangeEnd);
      const workLogs = await getAllFromStore('workLogs');
      const maintenanceOrders = await getAllFromStore('maintenanceOrders');

      const relevantWorkLogs = workLogs.filter((log) => log.batchId === batchId);
      const workLogsWithVersions = await Promise.all(
        relevantWorkLogs.map(async (log) => ({
          ...log,
          versions: await getWorkLogVersions(log.id),
        }))
      );

      const relevantMaintenance = maintenanceOrders.filter(
        (o) => o.batchId === batchId
      );

      const dataSources: { data: PressureDataPoint[]; type: 'shift_record' | 'work_log' | 'maintenance'; id: string }[] = [];

      for (const record of shiftRecords) {
        if (record.batchId === batchId) {
          dataSources.push({
            data: extractPressureFromShiftRecord(record),
            type: 'shift_record',
            id: record.id,
          });
        }
      }

      for (const log of workLogsWithVersions) {
        const latestVersion = log.versions?.[0] || {
          id: generateId('ver'),
          workLogId: log.id,
          version: log.currentVersion || 1,
          operator: log.operator || '',
          timestamp: Date.now(),
          content: log.content || '',
          parsedData: [],
        };
        dataSources.push({
          data: extractPressureFromWorkLog(latestVersion),
          type: 'work_log',
          id: log.id,
        });
      }

      const waveformData = alignDataByTime(
        dataSources,
        timeRangeStart,
        timeRangeEnd,
        60000
      );

      const crossingPoints = detectCrossThresholds(waveformData || [], 3);

      const analysisRunId = generateId('analysis');

      const dataSource = createDataSource(
        analysisRunId,
        shiftRecords.filter((r) => r.batchId === batchId),
        workLogsWithVersions,
        relevantMaintenance,
        timeRangeStart,
        timeRangeEnd
      );

      const sourceStats: SourceStats = {
        workLogCount: workLogsWithVersions.length,
        shiftRecordCount: shiftRecords.filter((r) => r.batchId === batchId).length,
        maintenanceCount: relevantMaintenance.length,
      };

      const conclusions = generateConclusions(
        crossingPoints,
        {
          shiftRecords: shiftRecords.filter((r) => r.batchId === batchId),
          workLogs: workLogsWithVersions,
          maintenanceOrders: relevantMaintenance,
        },
        analysisRunId
      );

      const overallResult = generateOverallResult(conclusions);
      const analysisDurationMs = Date.now() - startTime;

      const analysisRun: AnalysisRun = {
        id: analysisRunId,
        batchId,
        version,
        analysisTime: Date.now(),
        operator: user.name,
        analyst: user.name,
        status: 'completed',
        waveformData,
        conclusions,
        dataSource,
        overallResult,
        sourceStats,
        analysisDurationMs,
      };

      await addToStore('analysisRuns', analysisRun);

      const materials = get().materials;
      const analysisWithBatch = {
        ...analysisRun,
        batch: {
          ...batch,
          material: materials.find((m) => m.id === batch.materialId),
        },
      };

      const updatedRuns = [analysisWithBatch, ...get().analysisRuns];

      set({
        currentRun: analysisWithBatch,
        currentConclusions: conclusions,
        currentAnalysis: analysisWithBatch,
        analysisRuns: updatedRuns,
        loading: false,
      });
      return analysisWithBatch;
    } catch (error) {
      console.error('runPulseAnalysis error:', error);
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  selectAnalysisRun: (run) => {
    set({
      currentRun: run,
      currentConclusions: run.conclusions,
      currentAnalysis: run,
    });
  },

  setCurrentAnalysis: (analysis) => {
    set({
      currentAnalysis: analysis,
      currentRun: analysis,
      currentConclusions: analysis?.conclusions || [],
    });
  },

  clearError: () => set({ error: null }),
}));
