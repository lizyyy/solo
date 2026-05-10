const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.TEST_DB_PATH || path.join(__dirname, '..', 'data', 'fishing-boat.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS boats (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      registration_number TEXT NOT NULL UNIQUE,
      crew_capacity INTEGER NOT NULL,
      fuel_tank_capacity INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crew (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT NOT NULL UNIQUE,
      certificate_number TEXT,
      certificate_type TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS no_fishing_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      coordinates TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS declarations (
      id TEXT PRIMARY KEY,
      boat_id TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      expected_return_time TEXT NOT NULL,
      intended_route TEXT,
      fuel_amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boat_id) REFERENCES boats(id)
    );

    CREATE TABLE IF NOT EXISTS declaration_crew (
      id TEXT PRIMARY KEY,
      declaration_id TEXT NOT NULL,
      crew_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id) ON DELETE CASCADE,
      FOREIGN KEY (crew_id) REFERENCES crew(id),
      UNIQUE(declaration_id, crew_id)
    );

    CREATE TABLE IF NOT EXISTS return_receipts (
      id TEXT PRIMARY KEY,
      declaration_id TEXT NOT NULL,
      actual_return_time TEXT NOT NULL,
      return_reason TEXT,
      is_temporary INTEGER DEFAULT 0,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    CREATE TABLE IF NOT EXISTS fuel_records (
      id TEXT PRIMARY KEY,
      declaration_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      record_time TEXT DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      declaration_id TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      change_type TEXT DEFAULT 'normal',
      changed_by TEXT,
      change_reason TEXT,
      effective_time TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (declaration_id) REFERENCES declarations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_declarations_boat ON declarations(boat_id);
    CREATE INDEX IF NOT EXISTS idx_declarations_status ON declarations(status);
    CREATE INDEX IF NOT EXISTS idx_status_history_declaration ON status_history(declaration_id);
    CREATE INDEX IF NOT EXISTS idx_return_receipts_declaration ON return_receipts(declaration_id);
  `);
}

initDatabase();

module.exports = db;
