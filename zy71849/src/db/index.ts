import Dexie, { Table } from 'dexie';
import {
  Project,
  DeviceRemark,
  RemarkHistory,
  CADPoint,
  FlipRecord,
  MaterialBatch,
  SightRecord,
  TraceLink,
  InspectionItem,
} from '@/types';

export class AppDatabase extends Dexie {
  projects!: Table<Project, string>;
  deviceRemarks!: Table<DeviceRemark, string>;
  remarkHistories!: Table<RemarkHistory, string>;
  cadPoints!: Table<CADPoint, string>;
  flipRecords!: Table<FlipRecord, string>;
  materialBatches!: Table<MaterialBatch, string>;
  sightRecords!: Table<SightRecord, string>;
  traceLinks!: Table<TraceLink, string>;
  inspectionItems!: Table<InspectionItem, string>;

  constructor() {
    super('TheaterSeatSightDB');
    this.version(1).stores({
      projects: 'id, name, status, createdAt, updatedAt',
      deviceRemarks: 'id, projectId, deviceCode, batchId, modifiedAt, [projectId+batchId]',
      remarkHistories: 'id, remarkId, modifiedAt, modifier',
      cadPoints: 'id, projectId, pointCode, batchId, importedAt, [projectId+batchId]',
      flipRecords: 'id, cadPointId, projectId, status, assignee, [projectId+status]',
      materialBatches: 'id, projectId, batchNo, checksum, importedAt, [projectId+checksum]',
      sightRecords: 'id, projectId, batchId, deviceCode, status, createdAt, [projectId+batchId]',
      traceLinks: 'id, recordId, sourceType, sourceId',
      inspectionItems: 'id, recordId, projectId, category, isConfirmed, [projectId+category]',
    });
  }
}

export const db = new AppDatabase();

export async function clearDatabase() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}
