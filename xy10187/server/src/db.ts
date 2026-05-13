import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'database.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      monthly_allowance REAL NOT NULL DEFAULT 500,
      used_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      receipt_no TEXT NOT NULL,
      amount REAL NOT NULL,
      consumption_date TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      image_path TEXT,
      duplicate_group_id TEXT,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );

    CREATE TABLE IF NOT EXISTS status_logs (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      settlement_month TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_items (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id),
      FOREIGN KEY (receipt_id) REFERENCES receipts(id)
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      appellant TEXT NOT NULL,
      appeal_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      original_status TEXT,
      handler TEXT,
      handle_result TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id)
    );

    CREATE TABLE IF NOT EXISTS duplicate_groups (
      id TEXT PRIMARY KEY,
      receipt_no TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL
    );
  `);

  const columns = db.prepare("PRAGMA table_info(appeals)").all() as any[];
  const hasOriginalStatus = columns.some((col: any) => col.name === 'original_status');
  if (!hasOriginalStatus) {
    db.exec("ALTER TABLE appeals ADD COLUMN original_status TEXT");
  }
}
