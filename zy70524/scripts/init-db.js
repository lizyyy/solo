const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'risk.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    account_no TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    department TEXT,
    role TEXT,
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS device_fingerprints (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    fingerprint_hash TEXT NOT NULL,
    user_agent TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    language TEXT,
    platform TEXT,
    canvas_fingerprint TEXT,
    webgl_fingerprint TEXT,
    fonts TEXT,
    plugins TEXT,
    ip_address TEXT,
    is_trusted INTEGER DEFAULT 0,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    UNIQUE(account_id, fingerprint_hash)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS login_locations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    country TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    latitude REAL,
    longitude REAL,
    isp TEXT,
    is_common_location INTEGER DEFAULT 0,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS risk_events (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL,
    source_ip TEXT,
    source_location_id TEXT,
    device_fingerprint_id TEXT,
    raw_input TEXT NOT NULL,
    processing_rules TEXT,
    failure_reason TEXT,
    final_conclusion TEXT,
    detected_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (source_location_id) REFERENCES login_locations(id),
    FOREIGN KEY (device_fingerprint_id) REFERENCES device_fingerprints(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS disposition_actions (
    id TEXT PRIMARY KEY,
    risk_event_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_result TEXT NOT NULL,
    operator TEXT,
    operator_type TEXT NOT NULL,
    reason TEXT,
    executed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (risk_event_id) REFERENCES risk_events(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS review_conclusions (
    id TEXT PRIMARY KEY,
    risk_event_id TEXT NOT NULL UNIQUE,
    reviewer TEXT NOT NULL,
    review_result TEXT NOT NULL,
    review_comment TEXT,
    is_false_positive INTEGER DEFAULT 0,
    reviewed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (risk_event_id) REFERENCES risk_events(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_history (
    id TEXT PRIMARY KEY,
    risk_event_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    operator_type TEXT,
    change_reason TEXT,
    changed_at INTEGER NOT NULL,
    FOREIGN KEY (risk_event_id) REFERENCES risk_events(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_risk_events_account ON risk_events(account_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_risk_events_status ON risk_events(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_risk_events_level ON risk_events(risk_level)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_risk_events_created ON risk_events(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_event ON event_history(risk_event_id)`);

  console.log('数据库表创建完成');
});

db.close();
