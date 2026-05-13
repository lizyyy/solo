const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'email-bounces.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS address_status (
    email TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    soft_bounce_count INTEGER NOT NULL DEFAULT 0,
    last_bounce_type TEXT,
    last_bounce_reason TEXT,
    last_bounce_at INTEGER,
    can_send_marketing INTEGER NOT NULL DEFAULT 1,
    can_send_billing INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_sends (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    domain TEXT NOT NULL,
    business_type TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    message_id TEXT,
    FOREIGN KEY (email) REFERENCES address_status(email)
  );

  CREATE INDEX IF NOT EXISTS idx_email_sends_email ON email_sends(email);
  CREATE INDEX IF NOT EXISTS idx_email_sends_domain ON email_sends(domain);
  CREATE INDEX IF NOT EXISTS idx_email_sends_business_type ON email_sends(business_type);

  CREATE TABLE IF NOT EXISTS bounce_events (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    bounce_type TEXT NOT NULL,
    bounce_reason TEXT,
    business_type TEXT,
    message_id TEXT,
    received_at INTEGER NOT NULL,
    processed_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_bounce_events_id ON bounce_events(id);
  CREATE INDEX IF NOT EXISTS idx_bounce_events_email ON bounce_events(email);
`);

module.exports = db;
