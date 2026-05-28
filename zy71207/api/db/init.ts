import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'audit.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_contract (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      version TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      expire_date TEXT,
      base_rate REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(product_id, version)
    );

    CREATE TABLE IF NOT EXISTS customer_share (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      share_amount REAL NOT NULL,
      purchase_date TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      FOREIGN KEY (contract_id) REFERENCES product_contract(id)
    );

    CREATE TABLE IF NOT EXISTS rate_version (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      version TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      management_fee_rate REAL NOT NULL,
      service_fee_rate REAL NOT NULL,
      description TEXT,
      UNIQUE(product_id, version)
    );

    CREATE TABLE IF NOT EXISTS promotion_period (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_id TEXT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      discount_rate REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS charge_record (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      charge_date TEXT NOT NULL,
      share_amount REAL NOT NULL,
      applied_rate REAL NOT NULL,
      charged_amount REAL NOT NULL,
      rate_version_id TEXT NOT NULL,
      promotion_id TEXT,
      FOREIGN KEY (rate_version_id) REFERENCES rate_version(id),
      FOREIGN KEY (promotion_id) REFERENCES promotion_period(id)
    );

    CREATE TABLE IF NOT EXISTS audit_record (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      share_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      rate_version_id TEXT NOT NULL,
      promotion_id TEXT,
      charge_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expected_amount REAL NOT NULL,
      actual_amount REAL NOT NULL,
      diff_amount REAL NOT NULL,
      reasons TEXT NOT NULL,
      audit_time TEXT NOT NULL,
      resolved_time TEXT,
      rollback_id TEXT,
      FOREIGN KEY (share_id) REFERENCES customer_share(id),
      FOREIGN KEY (contract_id) REFERENCES product_contract(id),
      FOREIGN KEY (rate_version_id) REFERENCES rate_version(id),
      FOREIGN KEY (promotion_id) REFERENCES promotion_period(id),
      FOREIGN KEY (charge_id) REFERENCES charge_record(id),
      FOREIGN KEY (rollback_id) REFERENCES rollback_record(id)
    );

    CREATE TABLE IF NOT EXISTS rollback_record (
      id TEXT PRIMARY KEY,
      audit_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      rollback_amount REAL NOT NULL,
      compensation_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (audit_id) REFERENCES audit_record(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_customer ON audit_record(customer_id);
    CREATE INDEX IF NOT EXISTS idx_audit_product ON audit_record(product_id);
    CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_record(status);
    CREATE INDEX IF NOT EXISTS idx_charge_customer ON charge_record(customer_id);
    CREATE INDEX IF NOT EXISTS idx_charge_date ON charge_record(charge_date);
    CREATE INDEX IF NOT EXISTS idx_promotion_dates ON promotion_period(start_date, end_date);
  `);
}
