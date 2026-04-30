const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'events.db');

const db = new Database(dbPath, { fileMustExist: false });

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    total_slots INTEGER NOT NULL,
    check_in_code TEXT NOT NULL,
    sessions TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone_last_four TEXT NOT NULL,
    session TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    waitlist_position INTEGER,
    checked_in INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE INDEX IF NOT EXISTS idx_registrations_event 
  ON registrations(event_id);

  CREATE INDEX IF NOT EXISTS idx_registrations_status 
  ON registrations(status);
`);

module.exports = db;
