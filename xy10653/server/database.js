const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

const db = new Database(path.join(dbPath, 'daycare.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gender TEXT,
      birth_date TEXT,
      class_name TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      address TEXT,
      avatar TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS authorized_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relation TEXT,
      phone TEXT,
      id_card TEXT,
      photo_path TEXT,
      is_primary INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS temp_authorizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      authorized_person_id INTEGER,
      authorized_name TEXT NOT NULL,
      authorized_phone TEXT,
      relation TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'active',
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (authorized_person_id) REFERENCES authorized_persons(id)
    );

    CREATE TABLE IF NOT EXISTS temp_auth_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      temp_auth_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (temp_auth_id) REFERENCES temp_authorizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pickup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      pickup_date TEXT NOT NULL,
      pickup_time TEXT,
      authorized_person_id INTEGER,
      temp_auth_id INTEGER,
      pickup_person_name TEXT,
      pickup_person_phone TEXT,
      pickup_type TEXT,
      status TEXT DEFAULT 'normal',
      checkin_time TEXT,
      checkout_time TEXT,
      expected_checkout_time TEXT,
      is_late INTEGER DEFAULT 0,
      late_minutes INTEGER DEFAULT 0,
      late_fee REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (authorized_person_id) REFERENCES authorized_persons(id),
      FOREIGN KEY (temp_auth_id) REFERENCES temp_authorizations(id)
    );

    CREATE TABLE IF NOT EXISTS pickup_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pickup_record_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      exception_type TEXT NOT NULL,
      exception_level TEXT DEFAULT 'warning',
      description TEXT,
      status TEXT DEFAULT 'pending',
      handler TEXT,
      handle_time TEXT,
      handle_result TEXT,
      handle_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pickup_record_id) REFERENCES pickup_records(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exception_handover (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exception_id INTEGER NOT NULL,
      from_handler TEXT NOT NULL,
      to_handler TEXT NOT NULL,
      handover_time TEXT DEFAULT CURRENT_TIMESTAMP,
      handover_notes TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (exception_id) REFERENCES pickup_exceptions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manual_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pickup_record_id INTEGER,
      exception_id INTEGER,
      child_id INTEGER,
      adjustment_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      adjusted_by TEXT NOT NULL,
      adjusted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pickup_record_id) REFERENCES pickup_records(id),
      FOREIGN KEY (exception_id) REFERENCES pickup_exceptions(id),
      FOREIGN KEY (child_id) REFERENCES children(id)
    );

    CREATE TABLE IF NOT EXISTS late_fee_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grace_minutes INTEGER DEFAULT 15,
      fee_per_minute REAL DEFAULT 1.0,
      max_fee REAL DEFAULT 100,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ruleCount = db.prepare('SELECT COUNT(*) as count FROM late_fee_rules').get();
  if (ruleCount.count === 0) {
    db.prepare('INSERT INTO late_fee_rules (grace_minutes, fee_per_minute, max_fee) VALUES (?, ?, ?)').run(15, 2.0, 100);
  }
};

initDatabase();

module.exports = db;
