import { openDB, IDBPDatabase } from 'idb';
import { CompleteRecord, ViewState } from '../types';

const DB_NAME = 'sound-velocity-calibration';
const DB_VERSION = 1;
const STORE_NAME = 'records';

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('inputHash', 'inputHash');
          store.createIndex('conclusion', 'result.conclusion');
          store.createIndex('deviceId', 'input.deviceId');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveRecord(record: CompleteRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, record);
}

export async function getRecord(id: string): Promise<CompleteRecord | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function getAllRecords(): Promise<CompleteRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, 'createdAt');
}

export async function getRecordsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<CompleteRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex(STORE_NAME, 'createdAt');
  const start = startDate.getTime();
  const end = endDate.getTime();
  return records.filter(r => r.createdAt >= start && r.createdAt <= end);
}

export async function getRecordsByFilter(
  filters: Partial<{
    temperatureRange: [number, number];
    dateRange: [Date, Date];
    deviceIds: string[];
    conclusionTypes: string[];
  }>
): Promise<CompleteRecord[]> {
  let records = await getAllRecords();

  if (filters.dateRange) {
    const [start, end] = filters.dateRange;
    const startTime = start.getTime();
    const endTime = end.getTime();
    records = records.filter(r => r.createdAt >= startTime && r.createdAt <= endTime);
  }

  if (filters.temperatureRange) {
    const [min, max] = filters.temperatureRange;
    records = records.filter(r => {
      const temp = r.input.temperature;
      return temp !== null && temp >= min && temp <= max;
    });
  }

  if (filters.deviceIds && filters.deviceIds.length > 0) {
    records = records.filter(r => 
      r.input.deviceId && filters.deviceIds!.includes(r.input.deviceId)
    );
  }

  if (filters.conclusionTypes && filters.conclusionTypes.length > 0) {
    records = records.filter(r => 
      filters.conclusionTypes!.includes(r.result.conclusion)
    );
  }

  return records;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllRecords(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function getRecordByHash(inputHash: string): Promise<CompleteRecord | undefined> {
  const db = await getDB();
  const records = await db.getAllFromIndex(STORE_NAME, 'inputHash');
  return records.find(r => r.result.inputHash === inputHash);
}

export async function updateRecordNotes(id: string, notes: string): Promise<void> {
  const record = await getRecord(id);
  if (record) {
    record.input.notes = notes;
    record.updatedAt = Date.now();
    record.version += 1;
    await saveRecord(record);
  }
}

export async function exportAllData(): Promise<string> {
  const records = await getAllRecords();
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    recordCount: records.length,
    records,
  }, null, 2);
}

export async function importData(jsonData: string): Promise<number> {
  const data = JSON.parse(jsonData);
  if (!data.records || !Array.isArray(data.records)) {
    throw new Error('无效的导入数据格式');
  }

  let count = 0;
  for (const record of data.records) {
    await saveRecord(record);
    count++;
  }
  return count;
}
