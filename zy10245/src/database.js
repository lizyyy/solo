const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;
const dbPath = path.join(__dirname, '..', 'data', 'nursing-home.db');

function ensureDataDir() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function initDatabase() {
  ensureDataDir();
  
  if (!db) {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS elders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      room_number TEXT,
      bed_number TEXT,
      risk_level TEXT CHECK(risk_level IN ('normal', 'high', 'critical')) DEFAULT 'normal',
      medical_conditions TEXT,
      allergies TEXT,
      status TEXT CHECK(status IN ('active', 'archived')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS care_items (
      id TEXT PRIMARY KEY,
      elder_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scheduled_time TEXT,
      frequency TEXT,
      requires_acknowledgment BOOLEAN DEFAULT 0,
      status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled', 'closed_without_ack')) DEFAULT 'pending',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (elder_id) REFERENCES elders(id)
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('morning', 'night')) NOT NULL,
      date TEXT NOT NULL,
      started_at DATETIME,
      ended_at DATETIME,
      status TEXT CHECK(status IN ('scheduled', 'active', 'handover_submitted', 'handover_acknowledged', 'completed')) DEFAULT 'scheduled',
      nurse_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, date)
    );

    CREATE TABLE IF NOT EXISTS shift_handover (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      next_shift_id TEXT,
      submitted_by TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged_by TEXT,
      acknowledged_at DATETIME,
      notes TEXT,
      status TEXT CHECK(status IN ('draft', 'submitted', 'acknowledged', 'revoked')) DEFAULT 'draft',
      request_id TEXT UNIQUE,
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (next_shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS care_item_logs (
      id TEXT PRIMARY KEY,
      care_item_id TEXT NOT NULL,
      shift_id TEXT,
      action TEXT NOT NULL,
      performed_by TEXT,
      notes TEXT,
      request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (care_item_id) REFERENCES care_items(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS family_notes (
      id TEXT PRIMARY KEY,
      elder_id TEXT NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      is_important BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (elder_id) REFERENCES elders(id)
    );

    CREATE TABLE IF NOT EXISTS risk_alerts (
      id TEXT PRIMARY KEY,
      elder_id TEXT NOT NULL,
      shift_id TEXT,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged BOOLEAN DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (elder_id) REFERENCES elders(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      request_id TEXT UNIQUE,
      performed_by TEXT,
      details TEXT,
      status TEXT CHECK(status IN ('success', 'failed', 'blocked')) NOT NULL,
      block_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { getDb, initDatabase };
