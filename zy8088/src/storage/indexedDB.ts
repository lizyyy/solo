import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { WorkOrder, SyncQueueItem, ConflictRecord } from '../types';

interface SyncLabDB extends DBSchema {
  workOrders: {
    key: string;
    value: WorkOrder;
    indexes: { 'by-status': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-workOrderId': string; 'by-status': string };
  };
  conflicts: {
    key: string;
    value: ConflictRecord;
    indexes: { 'by-workOrderId': string };
  };
}

const DB_NAME = 'inspection-sync-lab';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SyncLabDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SyncLabDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<SyncLabDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const woStore = db.createObjectStore('workOrders', { keyPath: 'id' });
      woStore.createIndex('by-status', 'status');

      const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      queueStore.createIndex('by-workOrderId', 'workOrderId');
      queueStore.createIndex('by-status', 'status');

      db.createObjectStore('conflicts', { keyPath: 'workOrderId' });
    }
  });

  return dbInstance;
}

export async function saveWorkOrderLocal(wo: WorkOrder): Promise<void> {
  const db = await getDB();
  await db.put('workOrders', wo);
}

export async function getWorkOrderLocal(id: string): Promise<WorkOrder | undefined> {
  const db = await getDB();
  return db.get('workOrders', id);
}

export async function getAllWorkOrdersLocal(): Promise<WorkOrder[]> {
  const db = await getDB();
  return db.getAll('workOrders');
}

export async function deleteWorkOrderLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('workOrders', id);
}

export async function clearWorkOrdersLocal(): Promise<void> {
  const db = await getDB();
  await db.clear('workOrders');
}

function generateOperationSignature(item: Omit<SyncQueueItem, 'id' | 'status' | 'retryCount' | 'operationSignature'>): string {
  const { workOrderId, operation, payload, timestamp } = item;
  return `${workOrderId}:${operation}:${timestamp}:${JSON.stringify(payload)}`;
}

export async function addToSyncQueue(
  workOrderId: string,
  operation: 'create' | 'update',
  payload: Partial<WorkOrder>
): Promise<SyncQueueItem> {
  const db = await getDB();
  const timestamp = new Date().toISOString();

  const pendingItems = await db.getAllFromIndex('syncQueue', 'by-workOrderId', workOrderId);
  const pendingForSameOp = pendingItems.find(
    item => item.operation === operation && item.status === 'pending'
  );

  if (pendingForSameOp) {
    return pendingForSameOp;
  }

  const item: Omit<SyncQueueItem, 'id' | 'status' | 'retryCount' | 'operationSignature'> = {
    workOrderId,
    operation,
    payload,
    timestamp
  };

  const operationSignature = generateOperationSignature(item);

  const duplicateCheck = await db.getAll('syncQueue');
  const duplicate = duplicateCheck.find(
    entry => entry.operationSignature === operationSignature && entry.status !== 'conflict'
  );

  if (duplicate) {
    return duplicate;
  }

  const queueItem: SyncQueueItem = {
    ...item,
    id: `${workOrderId}-${Date.now()}`,
    status: 'pending',
    retryCount: 0,
    operationSignature
  };

  await db.put('syncQueue', queueItem);
  return queueItem;
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function getSyncQueueByWorkOrder(workOrderId: string): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-workOrderId', workOrderId);
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}

export async function saveConflict(conflict: ConflictRecord): Promise<void> {
  const db = await getDB();
  await db.put('conflicts', conflict);
}

export async function getConflict(workOrderId: string): Promise<ConflictRecord | undefined> {
  const db = await getDB();
  return db.get('conflicts', workOrderId);
}

export async function getAllConflicts(): Promise<ConflictRecord[]> {
  const db = await getDB();
  return db.getAll('conflicts');
}

export async function resolveConflict(workOrderId: string): Promise<void> {
  const db = await getDB();
  await db.delete('conflicts', workOrderId);
}

export async function clearConflicts(): Promise<void> {
  const db = await getDB();
  await db.clear('conflicts');
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('workOrders');
  await db.clear('syncQueue');
  await db.clear('conflicts');
}
