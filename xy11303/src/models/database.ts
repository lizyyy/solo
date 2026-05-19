import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'homestay.db');

let db: Database.Database;

export function initDatabase(): Database.Database {
  const fs = require('fs');
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      homestay_id TEXT NOT NULL,
      homestay_name TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_phone TEXT NOT NULL,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      room_count INTEGER DEFAULT 1,
      cleaning_fee REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cleaning_tasks (
      id TEXT PRIMARY KEY,
      task_no TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      homestay_id TEXT NOT NULL,
      homestay_name TEXT NOT NULL,
      cleaner_id TEXT,
      cleaner_name TEXT,
      cleaner_phone TEXT,
      scheduled_date TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL,
      required_photos INTEGER DEFAULT 5,
      submitted_photos INTEGER DEFAULT 0,
      started_at TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      completed_at TEXT,
      assigned_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (cleaner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      thumbnail_url TEXT,
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      uploaded_at TEXT NOT NULL,
      is_approved INTEGER DEFAULT 0,
      approved_at TEXT,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      complaint_no TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      task_id TEXT,
      reporter_id TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      reporter_phone TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      handler_id TEXT,
      handler_name TEXT,
      resolution TEXT,
      deduction_amount REAL DEFAULT 0,
      filed_at TEXT NOT NULL,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reworks (
      id TEXT PRIMARY KEY,
      rework_no TEXT UNIQUE NOT NULL,
      task_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      cleaner_id TEXT NOT NULL,
      cleaner_name TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL,
      photos_required INTEGER DEFAULT 3,
      photos_submitted INTEGER DEFAULT 0,
      started_at TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (requester_id) REFERENCES users(id),
      FOREIGN KEY (cleaner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS deductions (
      id TEXT PRIMARY KEY,
      deduction_no TEXT UNIQUE NOT NULL,
      settlement_id TEXT,
      task_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      related_id TEXT,
      related_type TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      is_appealed INTEGER DEFAULT 0,
      appeal_reason TEXT,
      is_confirmed INTEGER DEFAULT 0,
      confirmed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id),
      FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      settlement_no TEXT UNIQUE NOT NULL,
      cleaner_id TEXT NOT NULL,
      cleaner_name TEXT NOT NULL,
      cleaner_phone TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_tasks INTEGER DEFAULT 0,
      total_base_amount REAL DEFAULT 0,
      total_rework_count INTEGER DEFAULT 0,
      total_rework_deduction REAL DEFAULT 0,
      total_overtime_deduction REAL DEFAULT 0,
      total_complaint_deduction REAL DEFAULT 0,
      total_photo_deduction REAL DEFAULT 0,
      total_other_deduction REAL DEFAULT 0,
      total_deduction REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      status TEXT NOT NULL,
      paid_at TEXT,
      confirmed_at TEXT,
      operator_id TEXT,
      operator_name TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (cleaner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_items (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      task_no TEXT NOT NULL,
      homestay_name TEXT NOT NULL,
      base_amount REAL DEFAULT 0,
      rework_deduction REAL DEFAULT 0,
      overtime_deduction REAL DEFAULT 0,
      complaint_deduction REAL DEFAULT 0,
      photo_deduction REAL DEFAULT 0,
      other_deduction REAL DEFAULT 0,
      total_deduction REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      deduction_ids TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operator_id TEXT,
      operator_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      newValue TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_order ON cleaning_tasks(order_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_cleaner ON cleaning_tasks(cleaner_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON cleaning_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON cleaning_tasks(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_photos_task ON photos(task_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_order ON complaints(order_id);
    CREATE INDEX IF NOT EXISTS idx_reworks_task ON reworks(task_id);
    CREATE INDEX IF NOT EXISTS idx_deductions_task ON deductions(task_id);
    CREATE INDEX IF NOT EXISTS idx_deductions_settlement ON deductions(settlement_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_cleaner ON settlements(cleaner_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_dates ON settlements(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON settlement_items(settlement_id);
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    initDatabase();
  }
  return db;
}

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return dayjs().toISOString();
}

export function generateNo(prefix: string): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
}
