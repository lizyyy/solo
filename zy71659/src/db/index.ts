import Dexie from 'dexie';
import type { 
  ImportBatch, 
  RawSample, 
  AlignedSample, 
  OperationSegment, 
  Anomaly, 
  HistoryRecord, 
  AnalysisReport 
} from '../types';

export class TorqueLabDB extends Dexie {
  importBatches!: Dexie.Table<ImportBatch, string>;
  rawSamples!: Dexie.Table<RawSample, string>;
  alignedSamples!: Dexie.Table<AlignedSample, string>;
  segments!: Dexie.Table<OperationSegment, string>;
  anomalies!: Dexie.Table<Anomaly, string>;
  history!: Dexie.Table<HistoryRecord, string>;
  reports!: Dexie.Table<AnalysisReport, string>;

  constructor() {
    super('TorqueLabDB');
    
    this.version(1).stores({
      importBatches: '++id, deviceId, importedAt',
      rawSamples: '++id, batchId, timestamp, deviceId, [deviceId+timestamp]',
      alignedSamples: '++id, rawSampleId, timestamp, deviceId, segmentId',
      segments: '++id, deviceId, startTime, endTime',
      anomalies: '++id, type, severity, status, deviceId, detectedAt',
      history: '++id, entityType, entityId, timestamp, operator',
      reports: '++id, deviceId, generatedAt'
    });
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.importBatches.clear(),
      this.rawSamples.clear(),
      this.alignedSamples.clear(),
      this.segments.clear(),
      this.anomalies.clear(),
      this.history.clear(),
      this.reports.clear()
    ]);
  }
}

export const db = new TorqueLabDB();
