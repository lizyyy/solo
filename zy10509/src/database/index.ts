import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'operations.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeTables();
  }
});

function initializeTables(): void {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        operation_no TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        resource_object TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        executor_id TEXT NOT NULL,
        executor_name TEXT NOT NULL,
        reviewer_id TEXT,
        reviewer_name TEXT,
        status TEXT NOT NULL,
        plan_execute_time TEXT,
        actual_execute_time TEXT,
        complete_time TEXT,
        operation_result TEXT,
        error_message TEXT,
        raw_input TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS correction_records (
        id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        corrector_id TEXT NOT NULL,
        corrector_name TEXT NOT NULL,
        correction_reason TEXT NOT NULL,
        original_data TEXT NOT NULL,
        corrected_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (operation_id) REFERENCES operations(id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_operations_risk_level ON operations(risk_level)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at)
    `);

    console.log('数据库表初始化完成');
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function getOne<T>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | null);
    });
  });
}

export function getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export default db;
