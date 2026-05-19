import Database from 'better-sqlite3';
import { createTablesSQL } from './schema';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'pharmacy.db');

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(createTablesSQL);

  initializeSensitiveFieldConfigs(db);

  return db;
}

function initializeSensitiveFieldConfigs(db: Database.Database): void {
  const configs = [
    { entity: 'prescription', field: 'owner_phone', maskType: 'phone', exportMasked: 1, logMasked: 1 },
    { entity: 'prescription', field: 'owner_name', maskType: 'name', exportMasked: 0, logMasked: 1 },
    { entity: 'prescription', field: 'owner_id', maskType: 'idcard', exportMasked: 1, logMasked: 1 },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO sensitive_field_configs 
    (id, entity, field, mask_type, export_masked, log_masked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  for (const config of configs) {
    insert.run(
      uuidv4(),
      config.entity,
      config.field,
      config.maskType,
      config.exportMasked,
      config.logMasked,
      now
    );
  }
}

export function getDb(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function beginTransaction(): void {
  getDb().exec('BEGIN TRANSACTION');
}

export function commitTransaction(): void {
  getDb().exec('COMMIT');
}

export function rollbackTransaction(): void {
  getDb().exec('ROLLBACK');
}

export function withTransaction<T>(fn: () => T): T {
  beginTransaction();
  try {
    const result = fn();
    commitTransaction();
    return result;
  } catch (error) {
    rollbackTransaction();
    throw error;
  }
}