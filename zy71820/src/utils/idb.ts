import { openDB, IDBPDatabase, DBSchema } from 'idb';
import type { LevelConfig, GameSaveState } from '../types/game';
import type { PlayerScore, OperationHistory, DataVersion, ViewState } from '../types/data';

type StoreName = 'level_config' | 'player_score' | 'operation_history' | 'data_version' | 'view_state' | 'game_save';

interface NightMarketDB extends DBSchema {
  level_config: {
    key: string;
    value: LevelConfig;
    indexes: { 'by-source': string; 'by-updatedAt': number };
  };
  player_score: {
    key: string;
    value: PlayerScore;
    indexes: {
      'by-levelId': string;
      'by-status': string;
      'by-createdAt': number;
      'by-playerName': string;
    };
  };
  operation_history: {
    key: string;
    value: OperationHistory;
    indexes: { 'by-target': [string, string]; 'by-createdAt': number };
  };
  data_version: {
    key: string;
    value: DataVersion;
    indexes: { 'by-entity': [string, string]; 'by-version': number };
  };
  view_state: {
    key: string;
    value: ViewState;
    indexes: { 'by-page': string };
  };
  game_save: {
    key: string;
    value: GameSaveState;
    indexes: { 'by-savedAt': number };
  };
}

const DB_NAME = 'nightMarketDB';
const DB_VERSION = 1;

let db: IDBPDatabase<NightMarketDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<NightMarketDB>> {
  if (db) return db;

  db = await openDB<NightMarketDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('level_config')) {
        const levelStore = db.createObjectStore('level_config', { keyPath: 'id' });
        levelStore.createIndex('by-source', 'source');
        levelStore.createIndex('by-updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('player_score')) {
        const scoreStore = db.createObjectStore('player_score', { keyPath: 'id' });
        scoreStore.createIndex('by-levelId', 'levelId');
        scoreStore.createIndex('by-status', 'status');
        scoreStore.createIndex('by-createdAt', 'createdAt');
        scoreStore.createIndex('by-playerName', 'playerName');
      }

      if (!db.objectStoreNames.contains('operation_history')) {
        const historyStore = db.createObjectStore('operation_history', { keyPath: 'id' });
        historyStore.createIndex('by-target', ['targetType', 'targetId']);
        historyStore.createIndex('by-createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('data_version')) {
        const versionStore = db.createObjectStore('data_version', { keyPath: 'id' });
        versionStore.createIndex('by-entity', ['entityType', 'entityId']);
        versionStore.createIndex('by-version', 'version');
      }

      if (!db.objectStoreNames.contains('view_state')) {
        const viewStore = db.createObjectStore('view_state', { keyPath: 'id' });
        viewStore.createIndex('by-page', 'page');
      }

      if (!db.objectStoreNames.contains('game_save')) {
        const saveStore = db.createObjectStore('game_save', { keyPath: 'id' });
        saveStore.createIndex('by-savedAt', 'savedAt');
      }
    },
  });

  return db;
}

export function getDB(): IDBPDatabase<NightMarketDB> {
  if (!db) {
    throw new Error('IDB_NOT_INITIALIZED');
  }
  return db;
}

export async function closeDB(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}

export async function clearDB(): Promise<void> {
  const database = await initDB();
  const stores = database.objectStoreNames;
  for (let i = 0; i < stores.length; i++) {
    await database.clear(stores[i] as StoreName);
  }
}

export async function addRecord(
  storeName: StoreName,
  value: NightMarketDB[StoreName]['value']
): Promise<string> {
  const database = await initDB();
  return await database.add(storeName, value) as unknown as string;
}

export async function putRecord(
  storeName: StoreName,
  value: NightMarketDB[StoreName]['value']
): Promise<string> {
  const database = await initDB();
  return await database.put(storeName, value) as unknown as string;
}

export async function getRecord(
  storeName: StoreName,
  key: string
): Promise<NightMarketDB[StoreName]['value'] | undefined> {
  const database = await initDB();
  return await database.get(storeName, key);
}

export async function getAllRecords(
  storeName: StoreName
): Promise<NightMarketDB[StoreName]['value'][]> {
  const database = await initDB();
  return await database.getAll(storeName);
}

export async function deleteRecord(
  storeName: StoreName,
  key: string
): Promise<void> {
  const database = await initDB();
  await database.delete(storeName, key);
}

export async function getFromIndex(
  storeName: StoreName,
  indexName: string,
  query?: IDBValidKey | IDBKeyRange
): Promise<NightMarketDB[StoreName]['value'][]> {
  const database = await initDB();
  return await database.getAllFromIndex(storeName, indexName, query);
}

export async function countRecords(
  storeName: StoreName
): Promise<number> {
  const database = await initDB();
  return await database.count(storeName);
}

export async function withTransaction(
  storeNames: StoreName[],
  mode: 'readonly' | 'readwrite',
  callback: (tx: {
    store: (name: StoreName) => ReturnType<typeof database.transaction>['store'];
  }) => Promise<void>
): Promise<void> {
  const database = await initDB();
  const tx = database.transaction(storeNames, mode);
  await callback({
    store: (name: StoreName) => tx.store(name),
  });
  await tx.done;
}
