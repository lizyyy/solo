const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'linen-tracker.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id TEXT PRIMARY KEY,
      room_name TEXT NOT NULL,
      floor INTEGER,
      bed_type TEXT,
      bed_count INTEGER DEFAULT 1,
      duvet_sets INTEGER DEFAULT 0,
      sheets INTEGER DEFAULT 0,
      pillowcases INTEGER DEFAULT 0,
      bath_towels INTEGER DEFAULT 0,
      face_towels INTEGER DEFAULT 0,
      bath_mats INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS linen_types (
      type_code TEXT PRIMARY KEY,
      type_name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS wash_batches (
      batch_id TEXT PRIMARY KEY,
      batch_date TEXT NOT NULL,
      vendor TEXT,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'returned', 'partial', 'damaged')),
      total_sent INTEGER DEFAULT 0,
      total_returned INTEGER DEFAULT 0,
      total_damaged INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wash_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      linen_type TEXT NOT NULL,
      quantity_sent INTEGER NOT NULL,
      quantity_returned INTEGER DEFAULT 0,
      quantity_damaged INTEGER DEFAULT 0,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'returned', 'partial', 'damaged', 'missing')),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES wash_batches(batch_id),
      FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    );

    CREATE TABLE IF NOT EXISTS return_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      linen_type TEXT NOT NULL,
      quantity_returned INTEGER NOT NULL,
      quantity_damaged INTEGER DEFAULT 0,
      return_date TEXT NOT NULL,
      received_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES wash_batches(batch_id),
      FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    );

    CREATE TABLE IF NOT EXISTS damage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT,
      room_id TEXT NOT NULL,
      linen_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      damage_type TEXT,
      reported_date TEXT NOT NULL,
      reported_by TEXT,
      is_replaced INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES wash_batches(batch_id),
      FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    );

    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      record_type TEXT NOT NULL,
      total_rows INTEGER DEFAULT 0,
      processed_rows INTEGER DEFAULT 0,
      skipped_rows INTEGER DEFAULT 0,
      needs_review_rows INTEGER DEFAULT 0,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS import_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_log_id INTEGER NOT NULL,
      row_number INTEGER NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      raw_data TEXT,
      FOREIGN KEY (import_log_id) REFERENCES import_logs(id)
    );

    CREATE TABLE IF NOT EXISTS review_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT,
      room_id TEXT,
      linen_type TEXT,
      issue_type TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      sent_quantity INTEGER,
      returned_quantity INTEGER,
      damaged_quantity INTEGER,
      expected_quantity INTEGER,
      actual_quantity INTEGER,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'rejected')),
      resolution_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_wash_items_batch ON wash_items(batch_id);
    CREATE INDEX IF NOT EXISTS idx_wash_items_room ON wash_items(room_id);
    CREATE INDEX IF NOT EXISTS idx_return_records_batch ON return_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_return_records_room ON return_records(room_id);
    CREATE INDEX IF NOT EXISTS idx_review_items_status ON review_items(status);
  `);

  const types = db.prepare(`SELECT COUNT(*) as count FROM linen_types`).get();
  if (types.count === 0) {
    const insertType = db.prepare(`
      INSERT INTO linen_types (type_code, type_name, description) VALUES (?, ?, ?)
    `);
    insertType.run('duvet', '被套', '被子外套');
    insertType.run('sheet', '床单', '床罩');
    insertType.run('pillowcase', '枕套', '枕头套');
    insertType.run('bath_towel', '浴巾', '大毛巾');
    insertType.run('face_towel', '面巾', '小毛巾');
    insertType.run('bath_mat', '地巾', '浴室垫');
  }
}

initializeDatabase();

module.exports = db;
