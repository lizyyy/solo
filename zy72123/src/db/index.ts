import Dexie, { type Table } from 'dexie';
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
} from '@/types';

class RegBrakeDB extends Dexie {
  sensorBatches!: Table<SensorBatch>;
  sensorRecords!: Table<SensorRecord>;
  fieldNotes!: Table<FieldNote>;
  manualCorrections!: Table<ManualCorrection>;
  paramVersions!: Table<ParamVersion>;
  estimationRuns!: Table<EstimationRun>;
  estimationResults!: Table<EstimationResult>;
  anomalyRecords!: Table<AnomalyRecord>;
  conflictRecords!: Table<ConflictRecord>;
  dirtyDataRecords!: Table<DirtyDataRecord>;

  constructor() {
    super('EvRegenBrakingDB');
    this.version(1).stores({
      sensorBatches: 'id, name, importTime',
      sensorRecords: 'id, batchId, timestamp, status',
      fieldNotes: 'id, batchId, startTime',
      manualCorrections: 'id, batchId, recordId',
      paramVersions: 'id, paramId, versionNumber',
      estimationRuns: 'id, batchId, paramVersionId, runTime',
      estimationResults: 'id, runId, timestamp',
      anomalyRecords: 'id, runId, recordId, level',
      conflictRecords: 'id, runId, noteId',
      dirtyDataRecords: 'id, batchId, recordId, dirtyType',
    });
  }
}

export const db = new RegBrakeDB();
