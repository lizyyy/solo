import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/linen-reconciliation.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS reconciliation_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT UNIQUE NOT NULL,
        hotel_id TEXT NOT NULL,
        hotel_name TEXT NOT NULL,
        submit_date TEXT NOT NULL,
        wash_date TEXT NOT NULL,
        return_date TEXT NOT NULL,
        handler TEXT NOT NULL,
        room_standards TEXT NOT NULL,
        billing_items TEXT NOT NULL,
        processing_status TEXT NOT NULL,
        status_reason TEXT NOT NULL,
        error_details TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_batch_id ON reconciliation_records(batch_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_hotel_id ON reconciliation_records(hotel_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_processing_status ON reconciliation_records(processing_status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_submit_date ON reconciliation_records(submit_date)`);
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
