import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'deposit_system.db');

export async function initDatabase() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      total_count INTEGER DEFAULT 0,
      normal_count INTEGER DEFAULT 0,
      pending_count INTEGER DEFAULT 0,
      blocked_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      equipment_serial TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      rental_start_date TEXT NOT NULL,
      rental_end_date TEXT NOT NULL,
      deposit_amount REAL NOT NULL,
      actual_return_date TEXT,
      repair_cost REAL,
      overdue_days INTEGER,
      overdue_fee REAL,
      deduction_amount REAL,
      status TEXT NOT NULL,
      status_reason TEXT NOT NULL,
      next_action TEXT NOT NULL,
      processed_by TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS equipment (
      serial_number TEXT PRIMARY KEY,
      name TEXT,
      model TEXT,
      current_status TEXT NOT NULL DEFAULT 'available',
      current_rental_id TEXT,
      total_rental_count INTEGER DEFAULT 0,
      total_repair_cost REAL DEFAULT 0,
      last_maintenance_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rental_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      equipment_serial TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      actual_return_date TEXT,
      deposit_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      closed_at TEXT,
      FOREIGN KEY (equipment_serial) REFERENCES equipment(serial_number)
    );

    CREATE TABLE IF NOT EXISTS processing_records (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      previous_reason TEXT NOT NULL,
      new_reason TEXT NOT NULL,
      previous_deduction REAL,
      new_deduction REAL,
      changed_by TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS deduction_records (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      equipment_serial TEXT NOT NULL,
      deduction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      processed_by TEXT NOT NULL,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      duplicate_of TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_materials_batch ON materials(batch_id);
    CREATE INDEX IF NOT EXISTS idx_materials_serial ON materials(equipment_serial);
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_deduction_serial ON deduction_records(equipment_serial);
    CREATE INDEX IF NOT EXISTS idx_deduction_order ON deduction_records(order_no);
  `);

  return db;
}

export type Database = Awaited<ReturnType<typeof initDatabase>>;
