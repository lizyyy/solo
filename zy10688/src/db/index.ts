import sqlite3 from 'sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_DIR = join(process.cwd(), 'data');

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

let db: sqlite3.Database;

export const initDatabase = (): Promise<void> => {
  const DB_PATH = process.env.DB_PATH || join(DB_DIR, 'whitelist.db');
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const getDb = (): sqlite3.Database => db;

export const initDB = async (): Promise<void> => {
  await initDatabase();
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS whitelist_records (
          id TEXT PRIMARY KEY,
          account TEXT NOT NULL,
          reason TEXT NOT NULL,
          valid_from TEXT NOT NULL,
          valid_to TEXT NOT NULL,
          auditor TEXT NOT NULL,
          status TEXT NOT NULL,
          remark TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          version INTEGER DEFAULT 1
        )
      `, (err) => {
        if (err) reject(err);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS whitelist_history (
          id TEXT PRIMARY KEY,
          record_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          old_data TEXT,
          new_data TEXT,
          remark TEXT,
          operator TEXT NOT NULL,
          operated_at TEXT NOT NULL,
          FOREIGN KEY (record_id) REFERENCES whitelist_records(id)
        )
      `, (err) => {
        if (err) reject(err);
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_whitelist_account ON whitelist_records(account)
      `);
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_whitelist_status ON whitelist_records(status)
      `);
      
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_history_record_id ON whitelist_history(record_id)
      `);

      resolve();
    });
  });
};

export const runQuery = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows as T[]);
    });
  });
};

export const runGet = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      resolve(row as T);
    });
  });
};

export const runInsert = (sql: string, params: any[] = []): Promise<{ lastID: string; changes: number }> => {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      resolve({ lastID: String(this.lastID), changes: this.changes });
    });
  });
};

export const closeDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    getDb().close((err) => {
      if (err) reject(err);
      resolve();
    });
  });
};
