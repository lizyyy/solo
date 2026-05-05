const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'baggage.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY,
    flight_no TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    origin TEXT,
    destination TEXT,
    status TEXT DEFAULT 'on_ground',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS baggage (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL UNIQUE,
    flight_id TEXT NOT NULL,
    transfer_flight TEXT,
    carousel INTEGER,
    is_oversize INTEGER DEFAULT 0,
    is_transfer INTEGER DEFAULT 0,
    is_loaded INTEGER DEFAULT 0,
    loaded_time TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (flight_id) REFERENCES flights(id)
  );

  CREATE TABLE IF NOT EXISTS carousel_assignments (
    id TEXT PRIMARY KEY,
    flight_id TEXT NOT NULL,
    carousel_number INTEGER NOT NULL,
    assigned_by TEXT,
    assigned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (flight_id) REFERENCES flights(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    baggage_id TEXT NOT NULL,
    note_type TEXT NOT NULL,
    content TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    is_resolved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (baggage_id) REFERENCES baggage(id)
  );

  CREATE TABLE IF NOT EXISTS risk_alerts (
    id TEXT PRIMARY KEY,
    baggage_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    description TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    is_acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (baggage_id) REFERENCES baggage(id)
  );

  CREATE INDEX IF NOT EXISTS idx_baggage_barcode ON baggage(barcode);
  CREATE INDEX IF NOT EXISTS idx_baggage_flight ON baggage(flight_id);
  CREATE INDEX IF NOT EXISTS idx_risk_alerts_baggage ON risk_alerts(baggage_id);
`);

module.exports = db;
