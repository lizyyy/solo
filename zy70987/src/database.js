const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'detention.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      submitted_at DATETIME NOT NULL,
      items_count INTEGER NOT NULL,
      content_hash TEXT UNIQUE NOT NULL,
      raw_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detention_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      waybill_no TEXT,
      receiver_name TEXT,
      receiver_phone TEXT,
      detained_at TEXT,
      expected_pickup_at TEXT,
      parcel_type TEXT,
      storage_location TEXT,
      remark TEXT,
      raw_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS classification_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      category TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      reason_desc TEXT NOT NULL,
      action_required TEXT,
      action_deadline TEXT,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES detention_items(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS validation_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      item_id TEXT,
      row_index INTEGER NOT NULL,
      field_name TEXT,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (item_id) REFERENCES detention_items(id)
    );

    CREATE TABLE IF NOT EXISTS field_trace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      original_value TEXT,
      final_value TEXT,
      transformation_steps TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES detention_items(id)
    );

    CREATE INDEX IF NOT EXISTS idx_batches_hash ON batches(content_hash);
    CREATE INDEX IF NOT EXISTS idx_items_batch ON detention_items(batch_id);
    CREATE INDEX IF NOT EXISTS idx_results_item ON classification_results(item_id);
    CREATE INDEX IF NOT EXISTS idx_errors_batch ON validation_errors(batch_id);
  `);
}

initDatabase();

module.exports = db;
