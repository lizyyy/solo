import sqlite3 from 'sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../forex_quota.db');

export const db = new sqlite3.Database(dbPath);

const runQueryAsync = (sql: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const initDatabase = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          id_card_no TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS quota_ledgers (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          year INTEGER NOT NULL,
          total_quota REAL NOT NULL DEFAULT 50000,
          used_quota REAL NOT NULL DEFAULT 0,
          available_quota REAL NOT NULL DEFAULT 50000,
          version INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(customer_id, year)
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS exchange_rate_snapshots (
          id TEXT PRIMARY KEY,
          currency TEXT NOT NULL,
          buy_rate REAL NOT NULL,
          sell_rate REAL NOT NULL,
          snapshot_time TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          idempotent_key TEXT NOT NULL UNIQUE,
          customer_id TEXT NOT NULL,
          type TEXT NOT NULL,
          currency TEXT NOT NULL,
          foreign_currency_amount REAL NOT NULL,
          rmb_amount REAL NOT NULL,
          rate_snapshot_id TEXT NOT NULL,
          quota_ledger_id TEXT NOT NULL,
          status TEXT NOT NULL,
          remark TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS reversal_records (
          id TEXT PRIMARY KEY,
          original_transaction_id TEXT NOT NULL,
          transaction_id TEXT,
          reason TEXT NOT NULL,
          status TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_retry_at TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS idempotent_records (
          id TEXT PRIMARY KEY,
          idempotent_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL,
          response TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS failed_operations (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          error_message TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await runQueryAsync(`
        CREATE TABLE IF NOT EXISTS regulatory_reports (
          id TEXT PRIMARY KEY,
          report_date TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          total_buy_amount REAL NOT NULL DEFAULT 0,
          total_sell_amount REAL NOT NULL DEFAULT 0,
          transaction_count INTEGER NOT NULL DEFAULT 0,
          report_data TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(report_date, customer_id)
        )
      `);

      await runQueryAsync(`
        CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id, created_at)
      `);

      await runQueryAsync(`
        CREATE INDEX IF NOT EXISTS idx_quota_ledgers_customer ON quota_ledgers(customer_id, year)
      `);

      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};