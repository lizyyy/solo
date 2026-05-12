const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'alerts.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    service TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    assignee TEXT,
    affected_users INTEGER DEFAULT 0,
    affected_services TEXT DEFAULT '[]',
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    acknowledged_at INTEGER,
    escalated_at INTEGER,
    closed_at INTEGER,
    closed_reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_alert_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    service TEXT NOT NULL,
    metric TEXT,
    severity TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    affected_user_id TEXT,
    affected_user_name TEXT,
    raw_data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    sent_at INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS timeline (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor TEXT,
    description TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_events_fingerprint ON events(fingerprint)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_service ON events(service)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_event_id ON alerts(event_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_event_id ON timeline(event_id)`);
});

module.exports = db;
