import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'quality_control.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: sqlite3.Database;
let dbInitialized = false;

export async function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    sqlite3.verbose();
    db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      
      try {
        await createTables();
        await createIndexes();
        dbInitialized = true;
        resolve(db);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function runSql(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS sample_records (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      dish_id TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      sample_time TEXT NOT NULL,
      sample_person TEXT NOT NULL,
      sample_person_phone TEXT,
      expire_time TEXT NOT NULL,
      storage_location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      review_status TEXT,
      review_time TEXT,
      reviewer TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS temperature_records (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      fridge_id TEXT NOT NULL,
      fridge_name TEXT NOT NULL,
      record_time TEXT NOT NULL,
      temperature REAL NOT NULL,
      min_temp REAL NOT NULL,
      max_temp REAL NOT NULL,
      record_person TEXT NOT NULL,
      record_person_phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_status TEXT,
      review_time TEXT,
      reviewer TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS waste_records (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      dish_id TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      waste_time TEXT NOT NULL,
      waste_amount REAL NOT NULL,
      waste_reason TEXT NOT NULL,
      waste_person TEXT NOT NULL,
      waste_person_phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_status TEXT,
      review_time TEXT,
      reviewer TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS rule_logs (
      id TEXT PRIMARY KEY,
      rule_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      store_id TEXT NOT NULL,
      batch_no TEXT,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      processed_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      total_records INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      errors TEXT,
      imported_by TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing'
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      operated_at TEXT NOT NULL,
      ip TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ];

  for (const sql of tables) {
    try {
      await runSql(sql);
    } catch (err: any) {
      console.error('创建表失败:', err.message);
    }
  }
}

async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sample_store ON sample_records(store_id)',
    'CREATE INDEX IF NOT EXISTS idx_sample_batch ON sample_records(batch_no)',
    'CREATE INDEX IF NOT EXISTS idx_sample_time ON sample_records(sample_time)',
    'CREATE INDEX IF NOT EXISTS idx_sample_status ON sample_records(status)',
    'CREATE INDEX IF NOT EXISTS idx_temp_store ON temperature_records(store_id)',
    'CREATE INDEX IF NOT EXISTS idx_temp_time ON temperature_records(record_time)',
    'CREATE INDEX IF NOT EXISTS idx_temp_status ON temperature_records(status)',
    'CREATE INDEX IF NOT EXISTS idx_waste_store ON waste_records(store_id)',
    'CREATE INDEX IF NOT EXISTS idx_waste_batch ON waste_records(batch_no)',
    'CREATE INDEX IF NOT EXISTS idx_waste_time ON waste_records(waste_time)',
    'CREATE INDEX IF NOT EXISTS idx_rule_store ON rule_logs(store_id)',
    'CREATE INDEX IF NOT EXISTS idx_rule_record ON rule_logs(record_id, record_type)',
    'CREATE INDEX IF NOT EXISTS idx_rule_time ON rule_logs(processed_at)',
    'CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(operated_at)',
    'CREATE INDEX IF NOT EXISTS idx_import_time ON import_history(imported_at)'
  ];
  
  for (const sql of indexes) {
    try {
      await runSql(sql);
    } catch (err: any) {
      console.error('创建索引失败:', err.message);
    }
  }
}

export function getDb(): sqlite3.Database {
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
}

export function runQuery(sql: string, params: any[] = []): Promise<{ lastID: any; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}
