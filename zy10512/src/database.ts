import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/report-appeal.db');

let db: sqlite3.Database;

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbDir = path.dirname(DB_PATH);
    require('fs').mkdirSync(dbDir, { recursive: true });

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS report_snapshots (
          id TEXT PRIMARY KEY,
          report_name TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          metric_values TEXT NOT NULL,
          raw_data TEXT,
          created_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS appeals (
          id TEXT PRIMARY KEY,
          report_name TEXT NOT NULL,
          snapshot_date TEXT NOT NULL,
          snapshot_id TEXT NOT NULL,
          appellant TEXT NOT NULL,
          appellant_contact TEXT,
          appeal_reason TEXT NOT NULL,
          status TEXT NOT NULL,
          metric_values TEXT NOT NULL,
          raw_input TEXT,
          processing_basis TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          assignee TEXT,
          comments TEXT,
          FOREIGN KEY (snapshot_id) REFERENCES report_snapshots(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS correction_records (
          id TEXT PRIMARY KEY,
          appeal_id TEXT NOT NULL,
          corrected_by TEXT NOT NULL,
          corrected_at TEXT NOT NULL,
          original_values TEXT NOT NULL,
          corrected_values TEXT NOT NULL,
          correction_reason TEXT NOT NULL,
          FOREIGN KEY (appeal_id) REFERENCES appeals(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS explanation_reports (
          id TEXT PRIMARY KEY,
          appeal_id TEXT NOT NULL,
          content TEXT NOT NULL,
          generated_by TEXT,
          generated_at TEXT NOT NULL,
          attachments TEXT,
          FOREIGN KEY (appeal_id) REFERENCES appeals(id)
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_appeals_report_date ON appeals(report_name, snapshot_date)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_appeals_appellant ON appeals(appellant)
      `);

      resolve();
    });
  });
}

export function getDb(): sqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function runQuery(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}
