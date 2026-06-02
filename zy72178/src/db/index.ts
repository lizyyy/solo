import { openDB, IDBPDatabase } from 'idb';
import type {
  ModelVersion,
  CheckupRun,
  Sample,
  SampleResult,
  AuditLog,
  Note,
} from '../types';

const DB_NAME = 'rag-checkup-db';
const DB_VERSION = 1;

export interface DBSchema {
  modelVersions: {
    key: string;
    value: ModelVersion;
    indexes: { 'by-createdAt': string };
  };
  checkupRuns: {
    key: string;
    value: CheckupRun;
    indexes: { 'by-createdAt': string; 'by-modelVersionId': string };
  };
  samples: {
    key: string;
    value: Sample;
    indexes: { 'by-importedAt': string; 'by-knowledgeSource': string };
  };
  sampleResults: {
    key: string;
    value: SampleResult;
    indexes: {
      'by-checkupRunId': string;
      'by-sampleId': string;
      'by-checkupAndSample': [string, string];
    };
  };
  auditLogs: {
    key: string;
    value: AuditLog;
    indexes: { 'by-entity': [string, string]; 'by-createdAt': string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-entity': [string, string]; 'by-createdAt': string };
  };
}

let dbInstance: IDBPDatabase<DBSchema> | null = null;

export async function initializeDB(): Promise<void> {
  await getDB();
}

export async function getDB(): Promise<IDBPDatabase<DBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('modelVersions')) {
        const modelStore = db.createObjectStore('modelVersions', { keyPath: 'id' });
        modelStore.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('checkupRuns')) {
        const runStore = db.createObjectStore('checkupRuns', { keyPath: 'id' });
        runStore.createIndex('by-createdAt', 'startedAt');
        runStore.createIndex('by-modelVersionId', 'modelVersionId');
      }

      if (!db.objectStoreNames.contains('samples')) {
        const sampleStore = db.createObjectStore('samples', { keyPath: 'id' });
        sampleStore.createIndex('by-importedAt', 'importedAt');
        sampleStore.createIndex('by-knowledgeSource', 'knowledgeSource');
      }

      if (!db.objectStoreNames.contains('sampleResults')) {
        const resultStore = db.createObjectStore('sampleResults', { keyPath: 'id' });
        resultStore.createIndex('by-checkupRunId', 'checkupRunId');
        resultStore.createIndex('by-sampleId', 'sampleId');
        resultStore.createIndex('by-checkupAndSample', ['checkupRunId', 'sampleId']);
      }

      if (!db.objectStoreNames.contains('auditLogs')) {
        const auditStore = db.createObjectStore('auditLogs', { keyPath: 'id' });
        auditStore.createIndex('by-entity', ['entityType', 'entityId']);
        auditStore.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('notes')) {
        const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('by-entity', ['entityType', 'entityId']);
        noteStore.createIndex('by-createdAt', 'createdAt');
      }
    },
  });

  return dbInstance;
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function clearDatabase(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['modelVersions', 'checkupRuns', 'samples', 'sampleResults', 'auditLogs', 'notes'],
    'readwrite'
  );
  await Promise.all([
    tx.objectStore('modelVersions').clear(),
    tx.objectStore('checkupRuns').clear(),
    tx.objectStore('samples').clear(),
    tx.objectStore('sampleResults').clear(),
    tx.objectStore('auditLogs').clear(),
    tx.objectStore('notes').clear(),
    tx.done,
  ]);
}

export async function getAllFromStore<T extends keyof DBSchema>(
  storeName: T,
  indexName?: keyof DBSchema[T]['indexes'],
  direction?: IDBCursorDirection
): Promise<DBSchema[T]['value'][]> {
  const db = await getDB();
  if (indexName) {
    return (db as any).getAllFromIndex(storeName, indexName as string, undefined, direction);
  }
  return (db as any).getAll(storeName, undefined, direction) as Promise<DBSchema[T]['value'][]>;
}

export async function getFromStore<T extends keyof DBSchema>(
  storeName: T,
  key: DBSchema[T]['key']
): Promise<DBSchema[T]['value'] | undefined> {
  const db = await getDB();
  return db.get(storeName, key);
}

export async function putToStore<T extends keyof DBSchema>(
  storeName: T,
  value: DBSchema[T]['value']
): Promise<DBSchema[T]['key']> {
  const db = await getDB();
  return db.put(storeName, value) as Promise<DBSchema[T]['key']>;
}

export async function addToStore<T extends keyof DBSchema>(
  storeName: T,
  value: DBSchema[T]['value']
): Promise<DBSchema[T]['key']> {
  const db = await getDB();
  return db.add(storeName, value) as Promise<DBSchema[T]['key']>;
}

export async function deleteFromStore<T extends keyof DBSchema>(
  storeName: T,
  key: DBSchema[T]['key']
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, key);
}

export async function getFromIndex<T extends keyof DBSchema>(
  storeName: T,
  indexName: keyof DBSchema[T]['indexes'],
  query: IDBValidKey | IDBKeyRange
): Promise<DBSchema[T]['value'][]> {
  const db = await getDB();
  return db.getAllFromIndex(storeName, indexName as string, query);
}
