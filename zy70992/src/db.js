const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'canteen.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      subsidy_month TEXT NOT NULL,
      total_records INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS subsidy_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT,
      subsidy_type TEXT,
      monthly_limit REAL DEFAULT 0,
      daily_limit REAL DEFAULT 0,
      meal_limit INTEGER DEFAULT 0,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS card_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT,
      meal_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      card_time TEXT,
      raw_data TEXT,
      check_result TEXT DEFAULT 'pending',
      check_reason TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refund_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT,
      refund_date TEXT NOT NULL,
      refund_amount REAL DEFAULT 0,
      refund_reason TEXT,
      card_record_id INTEGER,
      matched INTEGER DEFAULT 0,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      FOREIGN KEY (card_record_id) REFERENCES card_records(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      card_record_id INTEGER,
      refund_record_id INTEGER,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      detail TEXT
    );

    CREATE TABLE IF NOT EXISTS processed_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT,
      meal_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      original_amount REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'approved',
      reject_reason TEXT,
      subsidy_type TEXT,
      subsidy_used REAL DEFAULT 0,
      refund_applied REAL DEFAULT 0,
      operator TEXT,
      processed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      remark TEXT,
      card_record_id INTEGER,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      FOREIGN KEY (card_record_id) REFERENCES card_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_card_student ON card_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_card_batch ON card_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_card_meal_date ON card_records(meal_date);
    CREATE INDEX IF NOT EXISTS idx_card_meal_type ON card_records(meal_type);
    CREATE INDEX IF NOT EXISTS idx_subsidy_student ON subsidy_lists(student_id);
    CREATE INDEX IF NOT EXISTS idx_subsidy_batch ON subsidy_lists(batch_id);
    CREATE INDEX IF NOT EXISTS idx_refund_student ON refund_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_refund_batch ON refund_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_logs_card ON operation_logs(card_record_id);
    CREATE INDEX IF NOT EXISTS idx_processed_student ON processed_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_processed_batch ON processed_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_processed_date ON processed_records(meal_date);
    CREATE INDEX IF NOT EXISTS idx_processed_status ON processed_records(status);
    CREATE INDEX IF NOT EXISTS idx_batches_month ON batches(subsidy_month);
    CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
  `);
}

function updateTimestamps(table, id) {
  return db.prepare(`UPDATE ${table} SET updated_at = datetime('now', 'localtime') WHERE id = ?`).run(id);
}

module.exports = { db, initSchema, updateTimestamps };
