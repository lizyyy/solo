import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

export const db = new sqlite3.Database('./equipment_rental.db');

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`PRAGMA foreign_keys = ON`);

      db.run(`
        CREATE TABLE IF NOT EXISTS equipment (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          model TEXT,
          serial_number TEXT UNIQUE,
          status TEXT NOT NULL DEFAULT 'available',
          deposit_amount REAL NOT NULL,
          daily_rate REAL NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS accessories (
          id TEXT PRIMARY KEY,
          equipment_id TEXT NOT NULL,
          name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'good',
          FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rental_orders (
          id TEXT PRIMARY KEY,
          order_no TEXT UNIQUE NOT NULL,
          equipment_id TEXT NOT NULL,
          borrower_name TEXT NOT NULL,
          borrower_phone TEXT,
          borrower_id TEXT,
          expected_start_date TEXT NOT NULL,
          expected_end_date TEXT NOT NULL,
          actual_start_date TEXT,
          actual_end_date TEXT,
          deposit_paid REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (equipment_id) REFERENCES equipment(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rental_accessories (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT NOT NULL,
          accessory_id TEXT NOT NULL,
          expected_quantity INTEGER NOT NULL,
          returned_quantity INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (rental_order_id) REFERENCES rental_orders(id),
          FOREIGN KEY (accessory_id) REFERENCES accessories(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS return_inspections (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT NOT NULL,
          inspector_name TEXT NOT NULL,
          inspection_date TEXT NOT NULL,
          has_scratches BOOLEAN DEFAULT false,
          scratches_description TEXT,
          has_damage BOOLEAN DEFAULT false,
          damage_description TEXT,
          accessories_complete BOOLEAN DEFAULT false,
          accessories_notes TEXT,
          overall_condition TEXT NOT NULL,
          conclusion TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          FOREIGN KEY (rental_order_id) REFERENCES rental_orders(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS deposit_deductions (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT NOT NULL,
          inspection_id TEXT,
          amount REAL NOT NULL,
          reason TEXT NOT NULL,
          requested_by TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          approved_by TEXT,
          approved_at TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          FOREIGN KEY (rental_order_id) REFERENCES rental_orders(id),
          FOREIGN KEY (inspection_id) REFERENCES return_inspections(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS exception_logs (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          original_input TEXT NOT NULL,
          error_message TEXT,
          processing_conclusion TEXT,
          handled_by TEXT,
          handled_at TEXT,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS manual_corrections (
          id TEXT PRIMARY KEY,
          rental_order_id TEXT,
          correction_type TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          reason TEXT NOT NULL,
          corrected_by TEXT NOT NULL,
          corrected_at TEXT NOT NULL
        )
      `);

      resolve();
    });
  });
}

export function generateId(): string {
  return uuidv4();
}

export function generateOrderNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RENT${dateStr}${random}`;
}

export function getCurrentTime(): string {
  return new Date().toISOString();
}
