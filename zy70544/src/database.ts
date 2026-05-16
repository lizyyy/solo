import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../data/billing.db');

export const initDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS recalculation_applications (
          id TEXT PRIMARY KEY,
          idempotency_key TEXT UNIQUE NOT NULL,
          billing_month TEXT NOT NULL,
          customer_account TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          reason_category TEXT NOT NULL,
          reason_detail TEXT NOT NULL,
          trigger_source TEXT NOT NULL,
          total_original_amount REAL NOT NULL DEFAULT 0,
          total_new_amount REAL NOT NULL DEFAULT 0,
          total_difference REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          current_approver TEXT,
          failure_reason TEXT,
          processing_basis TEXT,
          final_conclusion TEXT,
          report_url TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS impact_details (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL,
          item_code TEXT NOT NULL,
          item_name TEXT NOT NULL,
          original_amount REAL NOT NULL,
          new_amount REAL NOT NULL,
          difference REAL NOT NULL,
          remarks TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (application_id) REFERENCES recalculation_applications(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS approval_history (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL,
          status TEXT NOT NULL,
          approver TEXT NOT NULL,
          approver_role TEXT NOT NULL,
          opinion TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (application_id) REFERENCES recalculation_applications(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS recalculation_snapshots (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL,
          snapshot_type TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (application_id) REFERENCES recalculation_applications(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_application_billing_month 
        ON recalculation_applications(billing_month)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_application_customer_account 
        ON recalculation_applications(customer_account)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_application_status 
        ON recalculation_applications(status)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_application_idempotency_key 
        ON recalculation_applications(idempotency_key)
      `);
    });

    resolve(db);
  });
};

export default initDatabase;