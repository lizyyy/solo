const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db;

function getDb() {
  if (!db) {
    const dbDir = path.dirname(config.db.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(config.db.path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ticket_tiers (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      total_quantity INTEGER NOT NULL,
      sold_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity INTEGER NOT NULL DEFAULT 0,
      per_id_card_limit INTEGER,
      per_account_limit INTEGER,
      per_payment_limit INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (show_id) REFERENCES shows(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL,
      tier_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      id_card_no TEXT NOT NULL,
      payment_channel TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      fail_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      cancelled_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_idcard ON orders(id_card_no, status);
    CREATE INDEX IF NOT EXISTS idx_orders_tier ON orders(tier_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_channel, status);

    CREATE TABLE IF NOT EXISTS order_tickets (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      ticket_no TEXT NOT NULL,
      holder_name TEXT,
      holder_id_card TEXT,
      status TEXT NOT NULL DEFAULT 'valid',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_order_tickets_order ON order_tickets(order_id);

    CREATE TABLE IF NOT EXISTS queue_items (
      id TEXT PRIMARY KEY,
      tier_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      id_card_no TEXT NOT NULL,
      payment_channel TEXT,
      quantity INTEGER NOT NULL,
      position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      expire_at TEXT,
      matched_order_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_queue_tier ON queue_items(tier_id, status, position);
    CREATE INDEX IF NOT EXISTS idx_queue_account ON queue_items(account_id, status);

    CREATE TABLE IF NOT EXISTS compensation_tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      data TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 5,
      last_error TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_compensation_status ON compensation_tasks(status, next_retry_at);

    CREATE TABLE IF NOT EXISTS risk_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      account_id TEXT,
      id_card_no TEXT,
      ip TEXT,
      reason TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function transaction(fn) {
  const database = getDb();
  return database.transaction(fn)();
}

module.exports = { getDb, transaction };
