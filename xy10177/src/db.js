const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/meeting-room.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const tables = `
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  room_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES meeting_rooms(id)
);

CREATE TABLE IF NOT EXISTS catering (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  room_id TEXT,
  device_id TEXT,
  catering_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);

CREATE TABLE IF NOT EXISTS resource_locks (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  lock_type TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(resource_type, resource_id, lock_type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  old_start_time TEXT,
  old_end_time TEXT,
  old_room_id TEXT,
  old_device_id TEXT,
  old_catering_id TEXT,
  new_start_time TEXT,
  new_end_time TEXT,
  new_room_id TEXT,
  new_device_id TEXT,
  new_catering_id TEXT,
  status TEXT NOT NULL,
  step TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  callback_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_steps (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  transaction_id TEXT,
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_type, resource_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_meeting ON bookings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_locks_resource ON resource_locks(resource_type, resource_id, status);
CREATE INDEX IF NOT EXISTS idx_locks_transaction ON resource_locks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_meeting ON transactions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_history_meeting ON history(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(start_time, end_time);
`;

db.exec(tables);

const migrations = [
  `ALTER TABLE transactions ADD COLUMN original_status TEXT`,
];

for (const migration of migrations) {
  try {
    db.exec(migration);
    console.log(`[DB Migration] Applied: ${migration.substring(0, 50)}...`);
  } catch (err) {
    if (err.message.includes('duplicate column name') || 
        err.message.includes('already exists')) {
    } else {
      console.error('[DB Migration] Error:', err.message);
    }
  }
}

module.exports = db;
