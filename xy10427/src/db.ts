import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../meal-subsidy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_work_day INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);

    CREATE TABLE IF NOT EXISTS consumptions (
      transaction_id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      swipe_time TEXT NOT NULL,
      amount REAL NOT NULL,
      merchant TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_consumptions_employee ON consumptions(employee_id);
    CREATE INDEX IF NOT EXISTS idx_consumptions_time ON consumptions(swipe_time);

    CREATE TABLE IF NOT EXISTS subsidy_rules (
      rule_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      day_shift_amount REAL NOT NULL,
      night_shift_amount REAL NOT NULL,
      daily_limit REAL NOT NULL,
      meal_times_json TEXT NOT NULL,
      non_work_day_allowed INTEGER NOT NULL DEFAULT 0,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS abnormal_records (
      abnormal_id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      transaction_id TEXT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      batch_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_abnormal_employee ON abnormal_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_abnormal_type ON abnormal_records(type);

    CREATE TABLE IF NOT EXISTS subsidy_calculations (
      calculation_id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      original_amount REAL NOT NULL,
      adjusted_amount REAL NOT NULL,
      status TEXT NOT NULL,
      abnormal_ids_json TEXT,
      approval_status TEXT NOT NULL DEFAULT 'pending',
      batch_id TEXT,
      calculated_at TEXT NOT NULL,
      UNIQUE(employee_id, date, batch_id)
    );

    CREATE INDEX IF NOT EXISTS idx_calc_employee ON subsidy_calculations(employee_id);
    CREATE INDEX IF NOT EXISTS idx_calc_date ON subsidy_calculations(date);
    CREATE INDEX IF NOT EXISTS idx_calc_batch ON subsidy_calculations(batch_id);
    CREATE INDEX IF NOT EXISTS idx_calc_approval ON subsidy_calculations(approval_status);

    CREATE TABLE IF NOT EXISTS approval_records (
      approval_id TEXT PRIMARY KEY,
      calculation_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      action TEXT NOT NULL,
      new_amount REAL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_approval_calc ON approval_records(calculation_id);
    CREATE INDEX IF NOT EXISTS idx_approval_employee ON approval_records(employee_id);

    CREATE TABLE IF NOT EXISTS calculation_batches (
      batch_id TEXT PRIMARY KEY,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);
}

initDb();

export { db };
