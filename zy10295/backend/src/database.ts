import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../data/tire-management.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plate_number TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      tire_count INTEGER NOT NULL DEFAULT 6,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tires (
      id TEXT PRIMARY KEY,
      serial_number TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      size TEXT NOT NULL,
      initial_install_date DATETIME,
      current_status TEXT NOT NULL DEFAULT 'in_stock',
      current_vehicle_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS tire_events (
      id TEXT PRIMARY KEY,
      tire_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      vehicle_id TEXT,
      reason TEXT,
      inspection_result TEXT,
      inspection_notes TEXT,
      cost REAL,
      cost_notes TEXT,
      performed_by TEXT,
      performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tire_id) REFERENCES tires(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS tire_costs (
      id TEXT PRIMARY KEY,
      tire_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      cost_type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tire_id) REFERENCES tires(id),
      FOREIGN KEY (event_id) REFERENCES tire_events(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tires_serial ON tires(serial_number);
    CREATE INDEX IF NOT EXISTS idx_tires_status ON tires(current_status);
    CREATE INDEX IF NOT EXISTS idx_tire_events_tire ON tire_events(tire_id);
    CREATE INDEX IF NOT EXISTS idx_tire_events_type ON tire_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_tire_costs_tire ON tire_costs(tire_id);
  `);
}

export default db;
