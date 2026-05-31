import { openDB, IDBPDatabase } from 'idb';
import type {
  Material,
  Batch,
  ShiftRecord,
  WorkLog,
  WorkLogVersion,
  MaintenanceOrder,
  AnalysisRun,
  ChangeNotification,
  User,
} from '@/types';

const DB_NAME = 'pipeline_pulse_db';
const DB_VERSION = 1;

export interface PipelinePulseDB {
  materials: Material;
  batches: Batch;
  shiftRecords: ShiftRecord;
  workLogs: WorkLog;
  workLogVersions: WorkLogVersion;
  maintenanceOrders: MaintenanceOrder;
  analysisRuns: AnalysisRun;
  notifications: ChangeNotification;
  users: User;
}

let dbPromise: Promise<IDBPDatabase<PipelinePulseDB>> | null = null;

export function initDB(): Promise<IDBPDatabase<PipelinePulseDB>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<PipelinePulseDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('materials')) {
        const materialStore = db.createObjectStore('materials', { keyPath: 'id' });
        materialStore.createIndex('batchNo', 'batchNo', { unique: true });
      }

      if (!db.objectStoreNames.contains('batches')) {
        const batchStore = db.createObjectStore('batches', { keyPath: 'id' });
        batchStore.createIndex('materialId', 'materialId');
        batchStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('shiftRecords')) {
        const shiftStore = db.createObjectStore('shiftRecords', { keyPath: 'id' });
        shiftStore.createIndex('recordTime', 'recordTime');
        shiftStore.createIndex('shift', 'shift');
      }

      if (!db.objectStoreNames.contains('workLogs')) {
        const workLogStore = db.createObjectStore('workLogs', { keyPath: 'id' });
        workLogStore.createIndex('equipmentId', 'equipmentId');
        workLogStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('workLogVersions')) {
        const versionStore = db.createObjectStore('workLogVersions', { keyPath: 'id' });
        versionStore.createIndex('workLogId', 'workLogId');
        versionStore.createIndex('version', 'version');
        versionStore.createIndex('uploadedAt', 'uploadedAt');
      }

      if (!db.objectStoreNames.contains('maintenanceOrders')) {
        const maintenanceStore = db.createObjectStore('maintenanceOrders', { keyPath: 'id' });
        maintenanceStore.createIndex('orderNo', 'orderNo', { unique: true });
        maintenanceStore.createIndex('status', 'status');
        maintenanceStore.createIndex('startTime', 'startTime');
      }

      if (!db.objectStoreNames.contains('analysisRuns')) {
        const analysisStore = db.createObjectStore('analysisRuns', { keyPath: 'id' });
        analysisStore.createIndex('batchId', 'batchId');
        analysisStore.createIndex('version', 'version');
        analysisStore.createIndex('createdAt', 'createdAt');
        analysisStore.createIndex('batchId_version', ['batchId', 'version'], { unique: true });
      }

      if (!db.objectStoreNames.contains('notifications')) {
        const notificationStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notificationStore.createIndex('workLogId', 'workLogId');
        notificationStore.createIndex('reviewed', 'reviewed');
        notificationStore.createIndex('timestamp', 'timestamp');
      }

      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('employeeNo', 'employeeNo', { unique: true });
      }
    },
  });

  return dbPromise;
}

export async function getDB(): Promise<IDBPDatabase<PipelinePulseDB>> {
  if (!dbPromise) {
    return initDB();
  }
  return dbPromise;
}

export async function getAllFromStore<T extends keyof PipelinePulseDB>(
  storeName: T,
  indexName?: string,
  query?: IDBValidKey | IDBKeyRange
): Promise<PipelinePulseDB[T][]> {
  const db = await getDB();
  if (indexName) {
    return db.getAllFromIndex(storeName, indexName, query);
  }
  const results = await db.getAll(storeName);
  return results;
}

export async function getFromStore<T extends keyof PipelinePulseDB>(
  storeName: T,
  id: string
): Promise<PipelinePulseDB[T] | undefined> {
  const db = await getDB();
  return db.get(storeName, id);
}

export async function addToStore<T extends keyof PipelinePulseDB>(
  storeName: T,
  data: PipelinePulseDB[T]
): Promise<string> {
  const db = await getDB();
  const key = await db.add(storeName, data);
  return key as string;
}

export async function putToStore<T extends keyof PipelinePulseDB>(
  storeName: T,
  data: PipelinePulseDB[T]
): Promise<string> {
  const db = await getDB();
  const key = await db.put(storeName, data);
  return key as string;
}

export async function deleteFromStore<T extends keyof PipelinePulseDB>(
  storeName: T,
  id: string
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function getAnalysisRunsByBatchId(batchId: string): Promise<AnalysisRun[]> {
  const db = await getDB();
  const results = await db.getAllFromIndex('analysisRuns', 'batchId', batchId);
  return results.sort((a, b) => b.version - a.version);
}

export async function getNextAnalysisVersion(batchId: string): Promise<number> {
  const runs = await getAnalysisRunsByBatchId(batchId);
  return runs.length > 0 ? runs[0].version + 1 : 1;
}

export async function getWorkLogVersions(workLogId: string): Promise<WorkLogVersion[]> {
  const db = await getDB();
  const results = await db.getAllFromIndex('workLogVersions', 'workLogId', workLogId);
  return results.sort((a, b) => b.version - a.version);
}

export async function getShiftRecordsByTimeRange(
  startTime: number,
  endTime: number
): Promise<ShiftRecord[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(startTime, endTime);
  const results = await db.getAllFromIndex('shiftRecords', 'recordTime', range);
  return results.sort((a, b) => a.recordTime - b.recordTime);
}

export async function getUnreadNotifications(): Promise<ChangeNotification[]> {
  const db = await getDB();
  const results = await db.getAllFromIndex('notifications', 'reviewed', IDBKeyRange.only(false));
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = [
    'materials',
    'batches',
    'shiftRecords',
    'workLogs',
    'workLogVersions',
    'maintenanceOrders',
    'analysisRuns',
    'notifications',
    'users',
  ] as const;

  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((store) => tx.objectStore(store).clear()));
  await tx.done;
}

export async function initMockData(forceReset: boolean = false): Promise<void> {
  const db = await getDB();

  if (forceReset) {
    console.log('Force resetting IndexedDB...');
    await clearAllData();
  }

  const existingBatches = await db.count('batches');
  if (existingBatches > 0) {
    console.log('Mock data already exists, skipping initialization');
    return;
  }

  const {
    mockMaterials,
    mockBatches,
    mockShiftRecords,
    mockWorkLogs,
    mockWorkLogVersions,
    mockMaintenanceOrders,
    mockNotifications,
  } = await import('./mockData');

  const defaultUser = {
    id: 'user-001',
    name: '张工',
    employeeNo: 'EMP2024001',
    role: 'engineer' as const,
  };

  try {
    await db.put('users', defaultUser);

    for (const material of mockMaterials) {
      await db.put('materials', material);
    }

    for (const batch of mockBatches) {
      await db.put('batches', batch);
    }

    for (const record of mockShiftRecords) {
      await db.put('shiftRecords', record);
    }

    for (const log of mockWorkLogs) {
      await db.put('workLogs', log);
    }

    for (const version of mockWorkLogVersions) {
      await db.put('workLogVersions', version);
    }

    for (const order of mockMaintenanceOrders) {
      await db.put('maintenanceOrders', order);
    }

    for (const notification of mockNotifications) {
      await db.put('notifications', notification);
    }

    console.log('Mock data initialized successfully');
  } catch (error) {
    console.error('Failed to initialize mock data:', error);
    throw error;
  }
}
