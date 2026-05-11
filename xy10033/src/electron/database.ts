import * as Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    let dbPath: string;
    if (process.env.NODE_ENV === 'test') {
      dbPath = ':memory:';
    } else {
      try {
        const { app } = require('electron');
        dbPath = path.join(app.getPath('userData'), 'reissue.db');
      } catch {
        dbPath = path.join(process.cwd(), 'test.db');
      }
    }
    
    const BetterSqlite3 = require('better-sqlite3');
    const newDb = BetterSqlite3(dbPath) as Database.Database;
    newDb.pragma('journal_mode = WAL');
    newDb.pragma('foreign_keys = ON');
    initializeDatabase(newDb);
    db = newDb;
  }
  return db!;
}

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reissue_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT,
      product_name TEXT NOT NULL,
      product_sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      assignee_id TEXT,
      assignee_name TEXT,
      tracking_no TEXT,
      shipping_company TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reissue_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      before_status TEXT,
      after_status TEXT NOT NULL,
      change_reason TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES reissue_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      detail TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS failed_operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      error_message TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_attempt_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON reissue_orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_order_no ON reissue_orders(order_no);
    CREATE INDEX IF NOT EXISTS idx_orders_assignee ON reissue_orders(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON reissue_orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_history_order ON reissue_history(order_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_user ON audit_logs(user_id);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
