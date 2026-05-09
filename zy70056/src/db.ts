import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'aml-review.db');

export const db = new sqlite3.Database(dbPath);

export const initDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS list_versions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          version TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS hit_records (
          id TEXT PRIMARY KEY,
          list_version_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          transaction_id TEXT NOT NULL,
          match_reason TEXT NOT NULL,
          match_score REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending_review',
          current_block TEXT NOT NULL DEFAULT 'review',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (list_version_id) REFERENCES list_versions(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS account_freezes (
          id TEXT PRIMARY KEY,
          hit_record_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          freeze_reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'frozen',
          unfreeze_requested_by TEXT,
          unfreeze_requested_at TEXT,
          unfreeze_reason TEXT,
          unfrozen_by TEXT,
          unfrozen_at TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (hit_record_id) REFERENCES hit_records(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS review_records (
          id TEXT PRIMARY KEY,
          hit_record_id TEXT NOT NULL,
          decision TEXT NOT NULL,
          reviewer TEXT NOT NULL,
          comment TEXT NOT NULL,
          previous_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (hit_record_id) REFERENCES hit_records(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS approval_records (
          id TEXT PRIMARY KEY,
          account_freeze_id TEXT NOT NULL,
          hit_record_id TEXT NOT NULL,
          decision TEXT NOT NULL,
          approver TEXT NOT NULL,
          comment TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (account_freeze_id) REFERENCES account_freezes(id),
          FOREIGN KEY (hit_record_id) REFERENCES hit_records(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          action_type TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          actor TEXT NOT NULL,
          details TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_hit_account ON hit_records(account_id)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_freeze_account ON account_freezes(account_id)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)
      `, () => {
        resolve();
      });
    });
  });
};

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const allQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
