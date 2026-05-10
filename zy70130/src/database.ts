import fs from 'fs';
import path from 'path';
import { config } from './config';
import {
  User,
  Collection,
  TransferRecord,
  TransferHistory,
  FreezeRecord,
  AuditLog,
} from './types';

export interface DatabaseState {
  users: Map<string, User>;
  collections: Map<string, Collection>;
  transferRecords: Map<string, TransferRecord>;
  transferHistories: Map<string, TransferHistory[]>;
  freezeRecords: Map<string, FreezeRecord>;
  auditLogs: Map<string, AuditLog[]>;
}

let dbInstance: DatabaseState | null = null;
let persistTimer: NodeJS.Timeout | null = null;

export function getDatabase(): DatabaseState {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = createEmptyState();
  loadFromFile();
  setupAutoPersist();

  return dbInstance;
}

export function closeDatabase(): void {
  if (persistTimer) {
    clearInterval(persistTimer);
    persistTimer = null;
  }
  saveToFile();
  dbInstance = null;
}

export function setDatabaseForTest(state: DatabaseState): void {
  if (persistTimer) {
    clearInterval(persistTimer);
    persistTimer = null;
  }
  dbInstance = state;
}

export function createEmptyState(): DatabaseState {
  return {
    users: new Map(),
    collections: new Map(),
    transferRecords: new Map(),
    transferHistories: new Map(),
    freezeRecords: new Map(),
    auditLogs: new Map(),
  };
}

export function saveToFile(): void {
  if (!dbInstance) return;

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const data = {
    users: Array.from(dbInstance.users.entries()),
    collections: Array.from(dbInstance.collections.entries()),
    transferRecords: Array.from(dbInstance.transferRecords.entries()),
    transferHistories: Array.from(dbInstance.transferHistories.entries()),
    freezeRecords: Array.from(dbInstance.freezeRecords.entries()),
    auditLogs: Array.from(dbInstance.auditLogs.entries()),
  };

  fs.writeFileSync(config.dbPath + '.json', JSON.stringify(data, null, 2));
}

export function loadFromFile(): void {
  if (!dbInstance) return;

  const filePath = config.dbPath + '.json';
  if (!fs.existsSync(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    dbInstance.users = new Map(data.users || []);
    dbInstance.collections = new Map(data.collections || []);
    dbInstance.transferRecords = new Map(data.transferRecords || []);
    dbInstance.transferHistories = new Map(data.transferHistories || []);
    dbInstance.freezeRecords = new Map(data.freezeRecords || []);
    dbInstance.auditLogs = new Map(data.auditLogs || []);
  } catch (error) {
    console.error('加载数据库文件失败:', error);
  }
}

function setupAutoPersist(): void {
  persistTimer = setInterval(() => {
    saveToFile();
  }, 5000);
}

export function getAuditLogsByTargetKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}

export function getFreezeKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}
