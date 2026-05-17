import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'device_rebind.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS device_rebind (
        id TEXT PRIMARY KEY,
        device_code TEXT NOT NULL,
        old_store_id TEXT NOT NULL,
        old_store_name TEXT,
        new_store_id TEXT NOT NULL,
        new_store_name TEXT,
        repair_order_id TEXT,
        rebind_reason TEXT NOT NULL,
        rebind_report TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        warranty_valid BOOLEAN DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_by TEXT,
        approved_at DATETIME,
        original_input TEXT,
        processing_evidence TEXT,
        exception_reason TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS rebind_history (
        id TEXT PRIMARY KEY,
        rebind_id TEXT NOT NULL,
        device_code TEXT NOT NULL,
        old_store_id TEXT NOT NULL,
        new_store_id TEXT NOT NULL,
        status TEXT NOT NULL,
        operated_by TEXT,
        operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remark TEXT,
        FOREIGN KEY (rebind_id) REFERENCES device_rebind(id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_device_code ON device_rebind(device_code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_status ON device_rebind(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON device_rebind(created_at)`);
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allQuery(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
