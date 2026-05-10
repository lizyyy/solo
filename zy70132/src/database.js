const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db = null;

function initDatabase() {
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  createIndexes();

  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      seat_number TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      holder_id TEXT,
      payment_deadline INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(event_id, seat_number)
    );

    CREATE TABLE IF NOT EXISTS waitlist_queue (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'waiting',
      ticket_id TEXT,
      payment_deadline INTEGER,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payment_deadline INTEGER,
      paid_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      ticket_id TEXT,
      type TEXT NOT NULL,
      dedup_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER,
      last_error TEXT,
      sent_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(dedup_key)
    );

    CREATE TABLE IF NOT EXISTS escalation_reports (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      from_user_id TEXT,
      to_user_id TEXT,
      status TEXT NOT NULL,
      skipped_user_ids TEXT,
      reason TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS failed_tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_retry_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

function createIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_event_status ON tickets(event_id, status);
    CREATE INDEX IF NOT EXISTS idx_tickets_payment_deadline ON tickets(payment_deadline) WHERE status = 'pending_payment';
    
    CREATE INDEX IF NOT EXISTS idx_waitlist_event_status ON waitlist_queue(event_id, status);
    CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist_queue(event_id, position);
    
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_next_retry ON notifications(next_retry_at) WHERE status = 'failed';
    
    CREATE INDEX IF NOT EXISTS idx_transactions_ticket ON transactions(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_failed_tasks_next_retry ON failed_tasks(next_retry_at);
  `);
}

function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function transaction(fn) {
  const database = getDb();
  return database.transaction(fn)();
}

module.exports = {
  initDatabase,
  getDb,
  transaction,
};
