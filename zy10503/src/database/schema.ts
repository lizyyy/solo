import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const initDatabase = async () => {
  const db = await open({
    filename: './data/notification_receipt.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS notification_batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      channel TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      confirmed_count INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS tenant_accounts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT UNIQUE NOT NULL,
      tenant_name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      webhook_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_receipts (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at INTEGER,
      delivered_at INTEGER,
      confirmed_at INTEGER,
      failed_at INTEGER,
      fail_reason TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retry INTEGER DEFAULT 3,
      receipt_idempotent_key TEXT UNIQUE NOT NULL,
      original_input TEXT NOT NULL,
      processing_basis TEXT NOT NULL,
      final_conclusion TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES notification_batches(id),
      FOREIGN KEY (tenant_id) REFERENCES tenant_accounts(tenant_id)
    );

    CREATE TABLE IF NOT EXISTS resend_records (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      resend_count INTEGER DEFAULT 0,
      max_resend INTEGER DEFAULT 3,
      last_resend_at INTEGER,
      next_resend_at INTEGER,
      original_receipt_id TEXT NOT NULL,
      fail_reason TEXT,
      original_input TEXT NOT NULL,
      processing_basis TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES notification_receipts(id),
      FOREIGN KEY (batch_id) REFERENCES notification_batches(id)
    );

    CREATE TABLE IF NOT EXISTS reach_summaries (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      total_sent INTEGER DEFAULT 0,
      total_delivered INTEGER DEFAULT 0,
      total_confirmed INTEGER DEFAULT 0,
      total_failed INTEGER DEFAULT 0,
      total_timeout INTEGER DEFAULT 0,
      total_resent INTEGER DEFAULT 0,
      delivery_rate REAL DEFAULT 0,
      confirmation_rate REAL DEFAULT 0,
      failure_rate REAL DEFAULT 0,
      calculated_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES notification_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_batch_id ON notification_receipts(batch_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_tenant_id ON notification_receipts(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_status ON notification_receipts(status);
    CREATE INDEX IF NOT EXISTS idx_receipts_channel ON notification_receipts(channel);
    CREATE INDEX IF NOT EXISTS idx_resend_receipt_id ON resend_records(receipt_id);
    CREATE INDEX IF NOT EXISTS idx_summary_batch_id ON reach_summaries(batch_id);
  `);

  return db;
};

export type Database = Awaited<ReturnType<typeof initDatabase>>;
