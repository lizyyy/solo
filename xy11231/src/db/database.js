const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/battery_swap.db');
let db = null;

async function initDatabase() {
  if (db) return db;

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await createTables();
  
  return db;
}

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS import_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_records INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS device_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_time DATETIME NOT NULL,
      station_id TEXT,
      cabinet_id TEXT,
      battery_id TEXT,
      error_code TEXT,
      error_message TEXT,
      severity TEXT,
      status TEXT DEFAULT 'pending',
      assignee TEXT,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES import_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS service_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      ticket_id TEXT NOT NULL,
      ticket_type TEXT,
      customer_id TEXT,
      customer_name TEXT,
      phone TEXT,
      station_id TEXT,
      device_id TEXT,
      issue_type TEXT,
      description TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT,
      assignee TEXT,
      created_time DATETIME,
      resolved_time DATETIME,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES import_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS error_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      source_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      row_number INTEGER,
      raw_content TEXT,
      error_type TEXT,
      error_message TEXT NOT NULL,
      suggestion TEXT,
      resolved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES import_sessions(id)
    );
  `);

  await createIndexes();
}

async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON device_events(device_id)',
    'CREATE INDEX IF NOT EXISTS idx_device_events_event_time ON device_events(event_time)',
    'CREATE INDEX IF NOT EXISTS idx_device_events_status ON device_events(status)',
    'CREATE INDEX IF NOT EXISTS idx_device_events_assignee ON device_events(assignee)',
    'CREATE INDEX IF NOT EXISTS idx_service_tickets_ticket_id ON service_tickets(ticket_id)',
    'CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(status)',
    'CREATE INDEX IF NOT EXISTS idx_service_tickets_assignee ON service_tickets(assignee)',
    'CREATE INDEX IF NOT EXISTS idx_error_records_resolved ON error_records(resolved)'
  ];

  for (const index of indexes) {
    await db.exec(index);
  }
}

function getDb() {
  return db;
}

async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDb
};
