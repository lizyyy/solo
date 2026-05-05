const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tickets.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    store_name TEXT NOT NULL,
    store_timezone TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_utc INTEGER NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_created_utc ON tickets(created_utc);
  CREATE INDEX IF NOT EXISTS idx_tickets_store_id ON tickets(store_id);
`);

module.exports = db;
