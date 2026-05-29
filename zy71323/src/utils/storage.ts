import Dexie, { Table } from 'dexie';
import type { EstimationRecord } from '@/types';

export class TidalEnergyDatabase extends Dexie {
  records!: Table<EstimationRecord, string>;

  constructor() {
    super('TidalEnergyDB');
    this.version(1).stores({
      records: 'id, status, createdAt, updatedAt, parentId',
    });
  }
}

export const db = new TidalEnergyDatabase();

export const saveRecord = async (record: EstimationRecord): Promise<void> => {
  await db.records.put(record);
};

export const getRecord = async (id: string): Promise<EstimationRecord | undefined> => {
  return db.records.get(id);
};

export const getAllRecords = async (): Promise<EstimationRecord[]> => {
  return db.records.orderBy('createdAt').reverse().toArray();
};

export const deleteRecord = async (id: string): Promise<void> => {
  await db.records.delete(id);
};

export const searchRecords = async (query: string): Promise<EstimationRecord[]> => {
  const allRecords = await getAllRecords();
  const lowerQuery = query.toLowerCase();
  return allRecords.filter(
    r =>
      r.id.toLowerCase().includes(lowerQuery) ||
      r.note?.toLowerCase().includes(lowerQuery)
  );
};

export const getChildRecords = async (parentId: string): Promise<EstimationRecord[]> => {
  return db.records.where('parentId').equals(parentId).toArray();
};
