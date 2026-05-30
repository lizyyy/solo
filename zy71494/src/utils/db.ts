import { openDB, IDBPDatabase } from 'idb';
import type { Track, Beat, Segment, BPMHistory, TransitionScore, OperationLog } from '@/types';

const DB_NAME = 'dj-beat-assistant';
const DB_VERSION = 1;

export interface DBSchema {
  tracks: Track;
  beats: Beat;
  segments: Segment;
  bpmHistory: BPMHistory;
  transitionScores: TransitionScore;
  operationLogs: OperationLog;
  audioBlobs: { id: string; blob: Blob };
}

let dbPromise: Promise<IDBPDatabase<DBSchema>> | null = null;

export const getDB = async (): Promise<IDBPDatabase<DBSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<DBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
          trackStore.createIndex('name', 'name');
          trackStore.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('beats')) {
          const beatStore = db.createObjectStore('beats', { keyPath: 'id' });
          beatStore.createIndex('trackId', 'trackId');
          beatStore.createIndex('time', 'time');
        }

        if (!db.objectStoreNames.contains('segments')) {
          const segmentStore = db.createObjectStore('segments', { keyPath: 'id' });
          segmentStore.createIndex('trackId', 'trackId');
          segmentStore.createIndex('startTime', 'startTime');
        }

        if (!db.objectStoreNames.contains('bpmHistory')) {
          const bpmStore = db.createObjectStore('bpmHistory', { keyPath: 'id' });
          bpmStore.createIndex('trackId', 'trackId');
          bpmStore.createIndex('createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('transitionScores')) {
          const scoreStore = db.createObjectStore('transitionScores', { keyPath: 'id' });
          scoreStore.createIndex('trackId', 'trackId');
        }

        if (!db.objectStoreNames.contains('operationLogs')) {
          const logStore = db.createObjectStore('operationLogs', { keyPath: 'id' });
          logStore.createIndex('trackId', 'trackId');
          logStore.createIndex('timestamp', 'timestamp');
          logStore.createIndex('operationType', 'operationType');
        }

        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const saveAudioBlob = async (id: string, blob: Blob): Promise<void> => {
  const db = await getDB();
  await db.put('audioBlobs', { id, blob });
};

export const getAudioBlob = async (id: string): Promise<Blob | undefined> => {
  const db = await getDB();
  const result = await db.get('audioBlobs', id);
  return result?.blob;
};

export const deleteAudioBlob = async (id: string): Promise<void> => {
  const db = await getDB();
  await db.delete('audioBlobs', id);
};
