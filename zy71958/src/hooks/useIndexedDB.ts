import { openDB, IDBPDatabase } from 'idb';
import { AirspaceRecord, HistoryEntry, NoFlyZoneIssue, RouteVersion, Attachment } from '../types';

const DB_NAME = 'airspace-coordination';
const DB_VERSION = 1;

interface DBSchema {
  records: { key: string; value: AirspaceRecord; indexes: { status: string; createdAt: string; pilot: string } };
  history: { key: string; value: HistoryEntry; indexes: { recordId: string; timestamp: string; action: string } };
  issues: { key: string; value: NoFlyZoneIssue; indexes: { recordId: string; status: string; assignee: string } };
  routeVersions: { key: string; value: RouteVersion; indexes: { recordId: string; version: string } };
  attachments: { key: string; value: Attachment; indexes: { recordId: string; type: string } };
}

let dbInstance: IDBPDatabase<DBSchema> | null = null;

export async function initDB(): Promise<IDBPDatabase<DBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('records')) {
        const recordsStore = db.createObjectStore('records', { keyPath: 'id' });
        recordsStore.createIndex('status', 'status');
        recordsStore.createIndex('createdAt', 'createdAt');
        recordsStore.createIndex('pilot', 'pilot');
      }

      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('recordId', 'recordId');
        historyStore.createIndex('timestamp', 'timestamp');
        historyStore.createIndex('action', 'action');
      }

      if (!db.objectStoreNames.contains('issues')) {
        const issuesStore = db.createObjectStore('issues', { keyPath: 'id' });
        issuesStore.createIndex('recordId', 'recordId');
        issuesStore.createIndex('status', 'status');
        issuesStore.createIndex('assignee', 'assignee');
      }

      if (!db.objectStoreNames.contains('routeVersions')) {
        const routeVersionsStore = db.createObjectStore('routeVersions', { keyPath: 'id' });
        routeVersionsStore.createIndex('recordId', 'recordId');
        routeVersionsStore.createIndex('version', 'version');
      }

      if (!db.objectStoreNames.contains('attachments')) {
        const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'id' });
        attachmentsStore.createIndex('recordId', 'recordId');
        attachmentsStore.createIndex('type', 'type');
      }
    },
  });

  return dbInstance;
}

export function useIndexedDB() {
  const getDB = async () => {
    if (!dbInstance) {
      dbInstance = await initDB();
    }
    return dbInstance;
  };

  const getAllRecords = async (): Promise<AirspaceRecord[]> => {
    const db = await getDB();
    return db.getAllFromIndex('records', 'createdAt');
  };

  const getRecordById = async (id: string): Promise<AirspaceRecord | undefined> => {
    const db = await getDB();
    return db.get('records', id);
  };

  const addRecord = async (record: AirspaceRecord): Promise<string> => {
    const db = await getDB();
    return db.add('records', record) as Promise<string>;
  };

  const updateRecord = async (record: AirspaceRecord): Promise<string> => {
    const db = await getDB();
    return db.put('records', record) as Promise<string>;
  };

  const deleteRecord = async (id: string): Promise<void> => {
    const db = await getDB();
    return db.delete('records', id);
  };

  const getHistoryByRecordId = async (recordId: string): Promise<HistoryEntry[]> => {
    const db = await getDB();
    return db.getAllFromIndex('history', 'recordId', recordId);
  };

  const addHistoryEntry = async (entry: HistoryEntry): Promise<string> => {
    const db = await getDB();
    return db.add('history', entry) as Promise<string>;
  };

  const updateHistoryEntry = async (entry: HistoryEntry): Promise<string> => {
    const db = await getDB();
    return db.put('history', entry) as Promise<string>;
  };

  const getIssuesByRecordId = async (recordId: string): Promise<NoFlyZoneIssue[]> => {
    const db = await getDB();
    return db.getAllFromIndex('issues', 'recordId', recordId);
  };

  const addIssue = async (issue: NoFlyZoneIssue): Promise<string> => {
    const db = await getDB();
    return db.add('issues', issue) as Promise<string>;
  };

  const updateIssue = async (issue: NoFlyZoneIssue): Promise<string> => {
    const db = await getDB();
    return db.put('issues', issue) as Promise<string>;
  };

  const getRouteVersionsByRecordId = async (recordId: string): Promise<RouteVersion[]> => {
    const db = await getDB();
    return db.getAllFromIndex('routeVersions', 'recordId', recordId);
  };

  const getRouteVersionById = async (id: string): Promise<RouteVersion | undefined> => {
    const db = await getDB();
    return db.get('routeVersions', id);
  };

  const addRouteVersion = async (version: RouteVersion): Promise<string> => {
    const db = await getDB();
    return db.add('routeVersions', version) as Promise<string>;
  };

  const updateRouteVersion = async (version: RouteVersion): Promise<string> => {
    const db = await getDB();
    return db.put('routeVersions', version) as Promise<string>;
  };

  const getAttachmentsByRecordId = async (recordId: string): Promise<Attachment[]> => {
    const db = await getDB();
    return db.getAllFromIndex('attachments', 'recordId', recordId);
  };

  const addAttachment = async (attachment: Attachment): Promise<string> => {
    const db = await getDB();
    return db.add('attachments', attachment) as Promise<string>;
  };

  const clearAll = async (): Promise<void> => {
    const db = await getDB();
    const tx = db.transaction(['records', 'history', 'issues', 'routeVersions', 'attachments'], 'readwrite');
    await Promise.all([
      tx.objectStore('records').clear(),
      tx.objectStore('history').clear(),
      tx.objectStore('issues').clear(),
      tx.objectStore('routeVersions').clear(),
      tx.objectStore('attachments').clear(),
    ]);
    await tx.done;
  };

  const getAllData = async () => {
    const db = await getDB();
    const [records, history, issues, routeVersions, attachments] = await Promise.all([
      db.getAll('records'),
      db.getAll('history'),
      db.getAll('issues'),
      db.getAll('routeVersions'),
      db.getAll('attachments'),
    ]);
    return { records, history, issues, routeVersions, attachments };
  };

  return {
    getDB,
    getAllRecords,
    getRecordById,
    addRecord,
    updateRecord,
    deleteRecord,
    getHistoryByRecordId,
    addHistoryEntry,
    updateHistoryEntry,
    getIssuesByRecordId,
    addIssue,
    updateIssue,
    getRouteVersionsByRecordId,
    getRouteVersionById,
    addRouteVersion,
    updateRouteVersion,
    getAttachmentsByRecordId,
    addAttachment,
    clearAll,
    getAllData,
  };
}
