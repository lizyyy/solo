import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { QualityRecord, ReworkRecord, ImportHistory, AuditLog, BadRecord } from './types';

interface DataStore {
  qualityRecords: QualityRecord[];
  reworkRecords: ReworkRecord[];
  importHistories: ImportHistory[];
  auditLogs: AuditLog[];
  badRecords: BadRecord[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDatabase(): DataStore {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initialData: DataStore = {
      qualityRecords: [],
      reworkRecords: [],
      importHistories: [],
      auditLogs: [],
      badRecords: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    return initialData;
  }
  const content = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(content);
}

function saveDatabase(data: DataStore): void {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export const db = {
  qualityRecords: {
    findAll: (): QualityRecord[] => {
      const db = loadDatabase();
      return db.qualityRecords.filter(r => !r.isDeleted);
    },
    findByBatchId: (batchId: string): QualityRecord | undefined => {
      const db = loadDatabase();
      return db.qualityRecords.find(r => r.batchId === batchId && !r.isDeleted);
    },
    create: (record: Omit<QualityRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): QualityRecord => {
      const db = loadDatabase();
      const newRecord: QualityRecord = {
        ...record,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };
      db.qualityRecords.push(newRecord);
      saveDatabase(db);
      return newRecord;
    },
    bulkCreate: (records: Array<Omit<QualityRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>>): QualityRecord[] => {
      const db = loadDatabase();
      const newRecords = records.map(r => ({
        ...r,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      }));
      db.qualityRecords.push(...newRecords);
      saveDatabase(db);
      return newRecords;
    },
  },

  reworkRecords: {
    findAll: (): ReworkRecord[] => {
      const db = loadDatabase();
      return db.reworkRecords;
    },
    findByBatchId: (batchId: string): ReworkRecord[] => {
      const db = loadDatabase();
      return db.reworkRecords.filter(r => r.batchId === batchId);
    },
    create: (record: Omit<ReworkRecord, 'id' | 'createdAt'>): ReworkRecord => {
      const db = loadDatabase();
      const newRecord: ReworkRecord = {
        ...record,
        id: uuidv4(),
        createdAt: new Date(),
      };
      db.reworkRecords.push(newRecord);
      saveDatabase(db);
      return newRecord;
    },
    bulkCreate: (records: Array<Omit<ReworkRecord, 'id' | 'createdAt'>>): ReworkRecord[] => {
      const db = loadDatabase();
      const newRecords = records.map(r => ({
        ...r,
        id: uuidv4(),
        createdAt: new Date(),
      }));
      db.reworkRecords.push(...newRecords);
      saveDatabase(db);
      return newRecords;
    },
  },

  importHistories: {
    findAll: (): ImportHistory[] => {
      const db = loadDatabase();
      return db.importHistories;
    },
    findById: (id: string): ImportHistory | undefined => {
      const db = loadDatabase();
      return db.importHistories.find(h => h.id === id);
    },
    create: (history: Omit<ImportHistory, 'id' | 'startedAt'>): ImportHistory => {
      const db = loadDatabase();
      const newHistory: ImportHistory = {
        ...history,
        id: uuidv4(),
        startedAt: new Date(),
      };
      db.importHistories.push(newHistory);
      saveDatabase(db);
      return newHistory;
    },
    update: (id: string, updates: Partial<ImportHistory>): ImportHistory | null => {
      const db = loadDatabase();
      const index = db.importHistories.findIndex(h => h.id === id);
      if (index === -1) return null;
      db.importHistories[index] = { ...db.importHistories[index], ...updates };
      saveDatabase(db);
      return db.importHistories[index];
    },
  },

  auditLogs: {
    findAll: (): AuditLog[] => {
      const db = loadDatabase();
      return db.auditLogs;
    },
    create: (log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog => {
      const db = loadDatabase();
      const newLog: AuditLog = {
        ...log,
        id: uuidv4(),
        timestamp: new Date(),
      };
      db.auditLogs.push(newLog);
      saveDatabase(db);
      return newLog;
    },
  },

  badRecords: {
    findAll: (): BadRecord[] => {
      const db = loadDatabase();
      return db.badRecords;
    },
    findByImportHistoryId: (importHistoryId: string): BadRecord[] => {
      const db = loadDatabase();
      return db.badRecords.filter(b => b.importHistoryId === importHistoryId);
    },
    findUnresolved: (): BadRecord[] => {
      const db = loadDatabase();
      return db.badRecords.filter(b => !b.isResolved);
    },
    create: (record: Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'>): BadRecord => {
      const db = loadDatabase();
      const newRecord: BadRecord = {
        ...record,
        id: uuidv4(),
        createdAt: new Date(),
        isResolved: false,
      };
      db.badRecords.push(newRecord);
      saveDatabase(db);
      return newRecord;
    },
    bulkCreate: (records: Array<Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'>>): BadRecord[] => {
      const db = loadDatabase();
      const newRecords = records.map(r => ({
        ...r,
        id: uuidv4(),
        createdAt: new Date(),
        isResolved: false,
      }));
      db.badRecords.push(...newRecords);
      saveDatabase(db);
      return newRecords;
    },
    resolve: (id: string, resolvedBy: string): BadRecord | null => {
      const db = loadDatabase();
      const index = db.badRecords.findIndex(b => b.id === id);
      if (index === -1) return null;
      db.badRecords[index] = {
        ...db.badRecords[index],
        isResolved: true,
        resolvedBy,
        resolvedAt: new Date(),
      };
      saveDatabase(db);
      return db.badRecords[index];
    },
  },
};
