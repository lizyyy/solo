const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'webhook.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    provider TEXT,
    event_type TEXT,
    raw_body TEXT NOT NULL,
    headers_hash TEXT,
    headers_summary TEXT,
    signature TEXT,
    timestamp INTEGER,
    received_at INTEGER NOT NULL,
    signature_valid INTEGER DEFAULT 0,
    signature_error TEXT,
    timestamp_valid INTEGER DEFAULT 0,
    timestamp_error TEXT,
    status TEXT DEFAULT 'pending',
    confirmed_completed INTEGER DEFAULT 0,
    replay_disabled INTEGER DEFAULT 0,
    last_attempt_at INTEGER,
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    business_summary TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    mode TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    success INTEGER DEFAULT 0,
    error TEXT,
    details TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT,
    action TEXT NOT NULL,
    actor TEXT,
    timestamp INTEGER NOT NULL,
    details TEXT
  );
`);

try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_attempts_event_id ON attempts(event_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audits_event_id ON audits(event_id)');
} catch (e) {}

function prepare(sql) {
  const stmt = db.prepare(sql);
  return {
    run: (...args) => stmt.run(...args),
    get: (...args) => stmt.get(...args),
    all: (...args) => stmt.all(...args)
  };
}

function exec(sql) {
  db.exec(sql);
}

async function initDatabase() {
  return db;
}

module.exports = {
  initDatabase,
  prepare,
  exec,
  getDb: () => db
};
