import type { TimelineEvent } from '@/types/timeline';
import type { ImportPackage } from '@/types/import';
import type { GateSession } from '@/types/gate';

const DB_NAME = 'training-timeline-db';
const DB_VERSION = 1;

const STORE_EVENTS = 'events';
const STORE_PACKAGES = 'packages';
const STORE_SESSIONS = 'sessions';
const STORE_PREFERENCES = 'preferences';

let dbInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const eventStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        eventStore.createIndex('timestamp', 'timestamp');
        eventStore.createIndex('type', 'type');
        eventStore.createIndex('status', 'status');
      }

      if (!db.objectStoreNames.contains(STORE_PACKAGES)) {
        const packageStore = db.createObjectStore(STORE_PACKAGES, { keyPath: 'id' });
        packageStore.createIndex('uploadTime', 'uploadTime');
        packageStore.createIndex('status', 'status');
      }

      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('startTime', 'startTime');
      }

      if (!db.objectStoreNames.contains(STORE_PREFERENCES)) {
        db.createObjectStore(STORE_PREFERENCES, { keyPath: 'key' });
      }
    };
  });
}

export async function saveEvent(event: TimelineEvent): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EVENTS, 'readwrite');
    const store = transaction.objectStore(STORE_EVENTS);
    const request = store.put({ ...event, version: event.version + 1, lastModified: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveEvents(events: TimelineEvent[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EVENTS, 'readwrite');
    const store = transaction.objectStore(STORE_EVENTS);
    let completed = 0;
    events.forEach(event => {
      const request = store.put({ ...event, version: event.version + 1, lastModified: Date.now() });
      request.onsuccess = () => {
        completed++;
        if (completed === events.length) resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function getAllEvents(): Promise<TimelineEvent[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EVENTS, 'readonly');
    const store = transaction.objectStore(STORE_EVENTS);
    const index = store.index('timestamp');
    const request = index.getAll(null, 'prev');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getEventById(id: string): Promise<TimelineEvent | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EVENTS, 'readonly');
    const store = transaction.objectStore(STORE_EVENTS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EVENTS, 'readwrite');
    const store = transaction.objectStore(STORE_EVENTS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function savePackage(pkg: ImportPackage): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PACKAGES, 'readwrite');
    const store = transaction.objectStore(STORE_PACKAGES);
    const request = store.put(pkg);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllPackages(): Promise<ImportPackage[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PACKAGES, 'readonly');
    const store = transaction.objectStore(STORE_PACKAGES);
    const index = store.index('uploadTime');
    const request = index.getAll(null, 'prev');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: GateSession): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = transaction.objectStore(STORE_SESSIONS);
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSessions(): Promise<GateSession[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, 'readonly');
    const store = transaction.objectStore(STORE_SESSIONS);
    const index = store.index('startTime');
    const request = index.getAll(null, 'prev');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function savePreference(key: string, value: any): void {
  localStorage.setItem(`tl_${key}`, JSON.stringify(value));
}

export function getPreference<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(`tl_${key}`);
  if (stored) {
    try {
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

export function clearAllData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      dbInstance = null;
      Object.keys(localStorage).filter(k => k.startsWith('tl_')).forEach(k => localStorage.removeItem(k));
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
