const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/gym.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS member_packages (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        package_name TEXT NOT NULL,
        total_classes INTEGER NOT NULL,
        remaining_classes INTEGER NOT NULL,
        price REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        expire_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS coach_schedules (
        id TEXT PRIMARY KEY,
        coach_id TEXT NOT NULL,
        coach_name TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        package_id TEXT NOT NULL,
        schedule_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (package_id) REFERENCES member_packages(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS leave_deductions (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        leave_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        classes_deducted INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        old_remaining INTEGER,
        new_remaining INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (package_id) REFERENCES member_packages(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS transfer_commissions (
        id TEXT PRIMARY KEY,
        from_package_id TEXT NOT NULL,
        to_package_id TEXT NOT NULL,
        from_member_id TEXT NOT NULL,
        from_member_name TEXT NOT NULL,
        to_member_id TEXT NOT NULL,
        to_member_name TEXT NOT NULL,
        classes_transferred INTEGER NOT NULL,
        commission_rate REAL NOT NULL,
        commission_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        from_old_remaining INTEGER,
        from_new_remaining INTEGER,
        to_old_remaining INTEGER,
        to_new_remaining INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (from_package_id) REFERENCES member_packages(id),
        FOREIGN KEY (to_package_id) REFERENCES member_packages(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS refund_trials (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        refund_reason TEXT NOT NULL,
        classes_used INTEGER NOT NULL,
        classes_remaining INTEGER NOT NULL,
        original_price REAL NOT NULL,
        refund_amount REAL NOT NULL,
        deduction_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (package_id) REFERENCES member_packages(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS balance_ledger (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL UNIQUE,
        package_id TEXT,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        classes_change INTEGER NOT NULL,
        balance_before REAL NOT NULL,
        balance_after REAL NOT NULL,
        classes_before INTEGER NOT NULL,
        classes_after INTEGER NOT NULL,
        description TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        reference_id TEXT,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        description TEXT NOT NULL,
        ip_address TEXT,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);

      resolve();
    });
  });
};

module.exports = { db, initDatabase };
