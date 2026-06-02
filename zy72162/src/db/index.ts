import Dexie, { Table } from 'dexie';
import { GarbagePoint, SourceData, OperationLog, MergeConfig } from '@/types';

export class GarbageDB extends Dexie {
  points!: Table<GarbagePoint, string>;
  sources!: Table<SourceData, string>;
  logs!: Table<OperationLog, string>;
  config!: Table<MergeConfig, string>;
  photos!: Table<{ id: string; data: string }, string>;

  constructor() {
    super('GarbageHeatDB');
    this.version(1).stores({
      points: 'id, canonicalName, street, status, createdAt, updatedAt, [street+status]',
      sources: 'id, pointId, sourceType, importedAt',
      logs: 'id, pointId, action, timestamp',
      config: 'id',
      photos: 'id',
    });
  }
}

export const db = new GarbageDB();

export async function initDatabase(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch (error) {
    console.error('Failed to open database:', error);
    return false;
  }
}

export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', ['points', 'sources', 'logs', 'photos'], async () => {
    await db.points.clear();
    await db.sources.clear();
    await db.logs.clear();
    await db.photos.clear();
  });
}

export async function exportAllData(): Promise<string> {
  const points = await db.points.toArray();
  const sources = await db.sources.toArray();
  const logs = await db.logs.toArray();
  const config = await db.config.toArray();
  
  return JSON.stringify({
    version: '1.0',
    exportAt: new Date().toISOString(),
    points,
    sources,
    logs,
    config,
  }, null, 2);
}

export async function importAllData(jsonStr: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonStr);
    
    await db.transaction('rw', ['points', 'sources', 'logs', 'config'], async () => {
      if (data.points?.length) {
        await db.points.bulkAdd(data.points);
      }
      if (data.sources?.length) {
        await db.sources.bulkAdd(data.sources);
      }
      if (data.logs?.length) {
        await db.logs.bulkAdd(data.logs);
      }
      if (data.config?.length) {
        await db.config.bulkAdd(data.config);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}
