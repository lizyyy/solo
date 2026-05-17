import sqlite3 from 'sqlite3';
import { promisify } from 'util';

let db: sqlite3.Database | null = null;

export async function getDatabase(): Promise<sqlite3.Database> {
  if (!db) {
    db = new sqlite3.Database('./data-permission.db');
    await initTables(db);
  }
  return db;
}

function runAsync(db: sqlite3.Database, sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync<T = any>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync<T = any>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initTables(db: sqlite3.Database) {
  const execAsync = promisify(db.exec).bind(db);
  await execAsync(`
    CREATE TABLE IF NOT EXISTS organization_adjustments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      old_department_id TEXT NOT NULL,
      old_department_name TEXT NOT NULL,
      new_department_id TEXT NOT NULL,
      new_department_name TEXT NOT NULL,
      data_scope TEXT NOT NULL,
      retain_old_data_access INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operation_source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      effective_at TEXT,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS adjustment_histories (
      id TEXT PRIMARY KEY,
      adjustment_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operation_source TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (adjustment_id) REFERENCES organization_adjustments(id)
    );

    CREATE INDEX IF NOT EXISTS idx_adjustments_user_id ON organization_adjustments(user_id);
    CREATE INDEX IF NOT EXISTS idx_adjustments_status ON organization_adjustments(status);
    CREATE INDEX IF NOT EXISTS idx_adjustments_created_at ON organization_adjustments(created_at);
    CREATE INDEX IF NOT EXISTS idx_histories_adjustment_id ON adjustment_histories(adjustment_id);
  `);
}

export async function closeDatabase() {
  if (db) {
    const closeAsync = promisify(db.close).bind(db);
    await closeAsync();
    db = null;
  }
}

export { runAsync, getAsync, allAsync };
