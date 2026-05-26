import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/deduction.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      real_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      material_hash TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      archived_at INTEGER,
      archived_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (archived_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_batches_hash ON batches(material_hash);
    CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      material_type TEXT NOT NULL,
      waybill_no TEXT,
      file_name TEXT,
      file_path TEXT,
      file_size INTEGER,
      content TEXT,
      uploaded_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_materials_batch ON materials(batch_id);

    CREATE TABLE IF NOT EXISTS deduction_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      detail_no TEXT UNIQUE NOT NULL,
      waybill_no TEXT NOT NULL,
      exception_type TEXT NOT NULL,
      exception_time INTEGER NOT NULL,
      from_city TEXT,
      to_city TEXT,
      carrier TEXT,
      vehicle_no TEXT,
      driver TEXT,
      original_amount REAL NOT NULL DEFAULT 0,
      deduction_amount REAL NOT NULL DEFAULT 0,
      responsible_party TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      conclusion TEXT,
      handled_by INTEGER,
      handled_at INTEGER,
      final_handler_id INTEGER,
      final_handler_name TEXT,
      created_by INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      FOREIGN KEY (handled_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_details_batch ON deduction_details(batch_id);
    CREATE INDEX IF NOT EXISTS idx_details_status ON deduction_details(status);
    CREATE INDEX IF NOT EXISTS idx_details_waybill ON deduction_details(waybill_no);

    CREATE TABLE IF NOT EXISTS reconciliation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deduction_detail_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_waybill_no TEXT NOT NULL,
      source_data TEXT,
      matched_amount REAL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (deduction_detail_id) REFERENCES deduction_details(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_recon_detail ON reconciliation_items(deduction_detail_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deduction_detail_id INTEGER,
      batch_id INTEGER,
      operator_id INTEGER NOT NULL,
      operator_name TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (deduction_detail_id) REFERENCES deduction_details(id) ON DELETE SET NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_detail ON audit_logs(deduction_detail_id);
    CREATE INDEX IF NOT EXISTS idx_audit_batch ON audit_logs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
  `);
}

initDatabase();

export default db;
