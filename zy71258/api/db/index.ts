import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Gallery, LightSource, Artwork, SamplingData, Exhibition, Risk, ProtectionReport } from '../../src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

export interface DatabaseSchema {
  galleries: Gallery[];
  lightSources: LightSource[];
  artworks: Artwork[];
  samplings: SamplingData[];
  exhibitions: Exhibition[];
  risks: Risk[];
  reports: ProtectionReport[];
  idempotencyKeys: Record<string, { response: unknown; timestamp: number }>;
  auditLogs: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    ip?: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
}

type CollectionName = keyof DatabaseSchema;

class Database {
  private dbs: Map<CollectionName, Low<DatabaseSchema[CollectionName]>>;
  private fileMap: Record<CollectionName, string>;
  private initialized = false;

  constructor() {
    this.fileMap = {
      galleries: 'gallery.json',
      lightSources: 'lightSources.json',
      artworks: 'artworks.json',
      samplings: 'samplings.json',
      exhibitions: 'exhibitions.json',
      risks: 'risks.json',
      reports: 'reports.json',
      idempotencyKeys: 'idempotencyKeys.json',
      auditLogs: 'auditLogs.json',
    };
    this.dbs = new Map();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const { mkdir } = await import('fs/promises');
    await mkdir(DATA_DIR, { recursive: true });

    const collections: CollectionName[] = [
      'galleries', 'lightSources', 'artworks', 'samplings',
      'exhibitions', 'risks', 'reports', 'idempotencyKeys', 'auditLogs'
    ];

    for (const collection of collections) {
      const filePath = path.join(DATA_DIR, this.fileMap[collection]);
      const adapter = new JSONFile<DatabaseSchema[typeof collection]>(filePath);
      const db = new Low(adapter, this.getDefaultValue(collection));
      await db.read();
      if (db.data === null || db.data === undefined) {
        db.data = this.getDefaultValue(collection);
        await db.write();
      }
      this.dbs.set(collection, db);
    }

    this.initialized = true;
  }

  private getDefaultValue<T extends CollectionName>(collection: T): DatabaseSchema[T] {
    switch (collection) {
      case 'galleries':
        return [] as DatabaseSchema[T];
      case 'lightSources':
        return [] as DatabaseSchema[T];
      case 'artworks':
        return [] as DatabaseSchema[T];
      case 'samplings':
        return [] as DatabaseSchema[T];
      case 'exhibitions':
        return [] as DatabaseSchema[T];
      case 'risks':
        return [] as DatabaseSchema[T];
      case 'reports':
        return [] as DatabaseSchema[T];
      case 'idempotencyKeys':
        return {} as DatabaseSchema[T];
      case 'auditLogs':
        return [] as DatabaseSchema[T];
      default:
        return [] as DatabaseSchema[T];
    }
  }

  async getCollection<T extends CollectionName>(name: T): Promise<DatabaseSchema[T]> {
    await this.init();
    const db = this.dbs.get(name);
    if (!db) throw new Error(`Collection ${name} not found`);
    return db.data as DatabaseSchema[T];
  }

  async setCollection<T extends CollectionName>(name: T, data: DatabaseSchema[T]): Promise<void> {
    await this.init();
    const db = this.dbs.get(name);
    if (!db) throw new Error(`Collection ${name} not found`);
    db.data = data;
    await db.write();
  }

  async updateCollection<T extends CollectionName>(
    name: T,
    updater: (data: DatabaseSchema[T]) => DatabaseSchema[T] | Promise<DatabaseSchema[T]>
  ): Promise<DatabaseSchema[T]> {
    await this.init();
    const db = this.dbs.get(name);
    if (!db) throw new Error(`Collection ${name} not found`);
    const currentData = db.data as DatabaseSchema[T];
    const newData = await updater(currentData);
    db.data = newData;
    await db.write();
    return newData;
  }

  async getIdempotencyKey(key: string): Promise<{ response: unknown; timestamp: number } | undefined> {
    const keys = await this.getCollection('idempotencyKeys');
    return keys[key];
  }

  async setIdempotencyKey(key: string, response: unknown): Promise<void> {
    await this.updateCollection('idempotencyKeys', (keys) => ({
      ...keys,
      [key]: { response, timestamp: Date.now() },
    }));
  }

  async addAuditLog(log: Omit<DatabaseSchema['auditLogs'][0], 'id' | 'timestamp'>): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');
    await this.updateCollection('auditLogs', (logs) => [
      ...logs,
      {
        ...log,
        id: uuidv4(),
        timestamp: new Date().toISOString(),
      },
    ]);
  }
}

export const db = new Database();

export const collections = {
  galleries: 'galleries' as const,
  lightSources: 'lightSources' as const,
  artworks: 'artworks' as const,
  samplings: 'samplings' as const,
  exhibitions: 'exhibitions' as const,
  risks: 'risks' as const,
  reports: 'reports' as const,
};
