import { openDB, IDBPDatabase } from 'idb';
import { SwingSession } from '@/types';

const DB_NAME = 'golf-swing-db';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const REPORTS_STORE = 'reports';

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = async (): Promise<IDBPDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'sessionId' });
        sessionStore.createIndex('studentName', 'studentName');
        sessionStore.createIndex('recordedAt', 'recordedAt');
        sessionStore.createIndex('importedAt', 'importedAt');
        sessionStore.createIndex('dataFingerprint', 'dataFingerprint');
        sessionStore.createIndex('status', 'status');
      }

      if (!db.objectStoreNames.contains(REPORTS_STORE)) {
        const reportStore = db.createObjectStore(REPORTS_STORE, { keyPath: 'reportId' });
        reportStore.createIndex('sessionId', 'sessionId');
        reportStore.createIndex('createdAt', 'createdAt');
      }
    },
  });

  return dbPromise;
};

export const saveSession = async (session: SwingSession): Promise<void> => {
  const db = await initDB();
  const serializedSession = JSON.parse(JSON.stringify(session));
  await db.put(SESSIONS_STORE, serializedSession);
};

export const saveSessions = async (sessions: SwingSession[]): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(SESSIONS_STORE, 'readwrite');
  await Promise.all([
    ...sessions.map(s => tx.store.put(JSON.parse(JSON.stringify(s)))),
    tx.done,
  ]);
};

export const getSession = async (sessionId: string): Promise<SwingSession | undefined> => {
  const db = await initDB();
  const data = await db.get(SESSIONS_STORE, sessionId);
  if (!data) return undefined;
  return deserializeSession(data);
};

export const getAllSessions = async (): Promise<SwingSession[]> => {
  const db = await initDB();
  const data = await db.getAll(SESSIONS_STORE);
  return data.map(deserializeSession);
};

export const getSessionsByFingerprint = async (fingerprint: string): Promise<SwingSession[]> => {
  const db = await initDB();
  const index = db.transaction(SESSIONS_STORE).store.index('dataFingerprint');
  const data = await index.getAll(fingerprint);
  return data.map(deserializeSession);
};

export const getSessionsByStudent = async (studentName: string): Promise<SwingSession[]> => {
  const db = await initDB();
  const index = db.transaction(SESSIONS_STORE).store.index('studentName');
  const data = await index.getAll(studentName);
  return data.map(deserializeSession);
};

export const getSessionsByStatus = async (status: string): Promise<SwingSession[]> => {
  const db = await initDB();
  const index = db.transaction(SESSIONS_STORE).store.index('status');
  const data = await index.getAll(status);
  return data.map(deserializeSession);
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  const db = await initDB();
  await db.delete(SESSIONS_STORE, sessionId);
};

export const clearAllSessions = async (): Promise<void> => {
  const db = await initDB();
  await db.clear(SESSIONS_STORE);
};

export const getSessionCount = async (): Promise<number> => {
  const db = await initDB();
  return await db.count(SESSIONS_STORE);
};

const deserializeSession = (data: any): SwingSession => {
  return {
    ...data,
    recordedAt: new Date(data.recordedAt),
    importedAt: new Date(data.importedAt),
    versions: data.versions.map((v: any) => ({
      ...v,
      createdAt: new Date(v.createdAt),
    })),
    supplements: data.supplements.map((s: any) => ({
      ...s,
      supplementedAt: new Date(s.supplementedAt),
    })),
    anomalies: data.anomalies.map((a: any) => ({
      ...a,
      detectedAt: new Date(a.detectedAt),
      confirmedAt: a.confirmedAt ? new Date(a.confirmedAt) : undefined,
    })),
    keyframes: data.keyframes.map((k: any) => ({
      ...k,
      createdAt: new Date(k.createdAt),
    })),
  };
};

export const saveToLocalStorage = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

export const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return defaultValue;
  }
};

export const removeFromLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to remove from localStorage:', e);
  }
};

export const exportSessionAsJSON = (session: SwingSession): string => {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    session: JSON.parse(JSON.stringify(session)),
  };
  return JSON.stringify(exportData, null, 2);
};

export const importSessionFromJSON = (jsonString: string): SwingSession => {
  try {
    const data = JSON.parse(jsonString);
    if (!data.session) {
      throw new Error('Invalid session format');
    }
    return deserializeSession(data.session);
  } catch (e) {
    throw new Error(`Failed to parse session data: ${(e as Error).message}`);
  }
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};
