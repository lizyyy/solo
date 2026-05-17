import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'trial-recycle.db');

export const initDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      createTables(db)
        .then(() => resolve(db))
        .catch(reject);
    });
  });
};

const createTables = (db: sqlite3.Database): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS tenants (
          id TEXT PRIMARY KEY,
          tenant_id TEXT UNIQUE NOT NULL,
          tenant_name TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          sales_person TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS trial_features (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          feature_code TEXT NOT NULL,
          feature_name TEXT NOT NULL,
          trial_start_date TEXT NOT NULL,
          trial_end_date TEXT NOT NULL,
          original_end_date TEXT NOT NULL,
          granted_by TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS recycle_records (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          feature_id TEXT NOT NULL,
          trial_end_date TEXT NOT NULL,
          status TEXT NOT NULL,
          sales_confirm_status TEXT NOT NULL DEFAULT 'pending',
          sales_confirmed_at TEXT,
          sales_confirmed_by TEXT,
          sales_confirm_note TEXT,
          reminder_count INTEGER NOT NULL DEFAULT 0,
          last_reminder_at TEXT,
          recycle_action TEXT NOT NULL,
          recycle_note TEXT,
          recycled_at TEXT,
          recycled_by TEXT,
          extension_days INTEGER,
          extension_reason TEXT,
          extended_by TEXT,
          extended_at TEXT,
          summary TEXT,
          raw_input TEXT,
          processing_evidence TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (feature_id) REFERENCES trial_features(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS recycle_exceptions (
          id TEXT PRIMARY KEY,
          recycle_record_id TEXT NOT NULL,
          error_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          raw_input TEXT NOT NULL,
          processing_evidence TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at TEXT,
          resolved_by TEXT,
          resolution_note TEXT,
          FOREIGN KEY (recycle_record_id) REFERENCES recycle_records(id)
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_recycle_tenant ON recycle_records(tenant_id)
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export default DB_PATH;
