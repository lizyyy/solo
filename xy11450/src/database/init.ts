import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/equipment_return.db');

export function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS return_batches (
        id TEXT PRIMARY KEY,
        batch_no TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        order_id TEXT NOT NULL,
        total_deposit REAL DEFAULT 0,
        deductible_amount REAL DEFAULT 0,
        final_refund REAL DEFAULT 0,
        status TEXT NOT NULL,
        previous_status TEXT,
        freeze_reason TEXT,
        frozen_by TEXT,
        frozen_at TEXT,
        manual_reason TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_archived INTEGER DEFAULT 0,
        archived_at TEXT,
        archived_by TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS equipment_items (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        equipment_code TEXT NOT NULL,
        equipment_name TEXT NOT NULL,
        expected_return_date TEXT NOT NULL,
        actual_return_date TEXT,
        deposit_amount REAL DEFAULT 0,
        deductible_amount REAL DEFAULT 0,
        condition TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES return_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        uploaded_by TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        verified_by TEXT,
        verified_at TEXT,
        verification_notes TEXT,
        FOREIGN KEY (batch_id) REFERENCES return_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_value TEXT,
        new_value TEXT,
        reason TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        ip_address TEXT,
        FOREIGN KEY (batch_id) REFERENCES return_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS failed_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        failure_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_details TEXT,
        source_data TEXT NOT NULL,
        failed_at TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        resolved_by TEXT,
        resolution_notes TEXT,
        FOREIGN KEY (batch_id) REFERENCES return_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deposit_deductions (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        equipment_id TEXT,
        deduction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        evidence_attachment_ids TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_approved INTEGER DEFAULT 0,
        approved_by TEXT,
        approved_at TEXT,
        FOREIGN KEY (batch_id) REFERENCES return_batches(id),
        FOREIGN KEY (equipment_id) REFERENCES equipment_items(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_status ON return_batches(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_customer ON return_batches(customer_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_created ON return_batches(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_batch ON audit_logs(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_batch ON attachments(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_failed_resolved ON failed_records(resolved)`);
    });

    resolve(db);
  });
}

export let db: sqlite3.Database;

export async function initializeDB() {
  db = await initDatabase();
}

export function getDB(): sqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
