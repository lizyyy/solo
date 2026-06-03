import Dexie, { Table } from 'dexie';
import type {
  CoordinateOriginRow,
  PhotoPoint,
  CoordinateTableEntry,
  OcclusionEntry,
  CanonicalResult,
  AuditLog,
  SelfCheckResult,
  WorkflowState,
} from '../types';
import { mockPhotoPoints, mockCoordinateTable, mockOcclusionList } from '../data/mockData';

export class AppDatabase extends Dexie {
  coordinateOrigin!: Table<CoordinateOriginRow, string>;
  photoPoints!: Table<PhotoPoint, string>;
  coordinateTable!: Table<CoordinateTableEntry, string>;
  occlusionList!: Table<OcclusionEntry, string>;
  canonicalResults!: Table<CanonicalResult, string>;
  auditLogs!: Table<AuditLog, string>;
  selfCheckResults!: Table<SelfCheckResult, string>;
  workflowState!: Table<WorkflowState, string>;

  constructor() {
    super('BridgeCrackAnnotationDB');

    this.version(1).stores({
      coordinateOrigin: '&id, originalLineNumber, photoPointId, processingStatus',
      photoPoints: '&id, photoNumber',
      coordinateTable: '&id, photoPointId',
      occlusionList: '&id, photoPointId',
      canonicalResults: '&version, generatedAt',
      auditLogs: '&id, timestamp, operator',
      selfCheckResults: '&type, checkedAt',
      workflowState: '&currentStep',
    });
  }

  async initializeMockData(): Promise<void> {
    const existingPoints = await this.photoPoints.count();
    if (existingPoints === 0) {
      await this.photoPoints.bulkAdd(mockPhotoPoints);
      await this.coordinateTable.bulkAdd(mockCoordinateTable);
      await this.occlusionList.bulkAdd(mockOcclusionList);
    }
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      for (const table of this.tables) {
        await table.clear();
      }
    });
  }
}

export const db = new AppDatabase();

export async function initDatabase(): Promise<void> {
  await db.initializeMockData();
}
