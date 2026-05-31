import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'guarantee.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guarantee_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guaranteeNo TEXT NOT NULL,
      customerName TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      source TEXT NOT NULL,
      sourceRef TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      pendingReason TEXT,
      reviewReason TEXT,
      currentOperator TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      isDuplicate INTEGER NOT NULL DEFAULT 0,
      duplicateWith INTEGER,
      remark TEXT,
      FOREIGN KEY (duplicateWith) REFERENCES guarantee_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_guarantee_no ON guarantee_records(guaranteeNo);
    CREATE INDEX IF NOT EXISTS idx_status ON guarantee_records(status);
    CREATE INDEX IF NOT EXISTS idx_created_at ON guarantee_records(createdAt);
    CREATE INDEX IF NOT EXISTS idx_customer ON guarantee_records(customerName);

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recordId INTEGER NOT NULL,
      operation TEXT NOT NULL,
      operator TEXT NOT NULL,
      oldStatus TEXT,
      newStatus TEXT,
      changes TEXT NOT NULL,
      reason TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (recordId) REFERENCES guarantee_records(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_log_record_id ON operation_logs(recordId);
    CREATE INDEX IF NOT EXISTS idx_log_created_at ON operation_logs(createdAt);
  `);
}

initDatabase();

export default db;
