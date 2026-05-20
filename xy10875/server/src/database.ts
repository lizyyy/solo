import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'reimbursement.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    initializeTables();
  }
});

function initializeTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS budget_categories (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT,
      annual_budget REAL DEFAULT 0,
      used_budget REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS trip_records (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT,
      trip_type TEXT,
      departure_city TEXT,
      arrival_city TEXT,
      start_date DATE,
      end_date DATE,
      purpose TEXT,
      estimated_amount REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS reimbursement_forms (
      id TEXT PRIMARY KEY,
      form_no TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT,
      trip_id TEXT,
      budget_category_id TEXT,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      submitted_at DATETIME,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trip_records(id),
      FOREIGN KEY (budget_category_id) REFERENCES budget_categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_images (
      id TEXT PRIMARY KEY,
      invoice_no TEXT,
      invoice_code TEXT,
      invoice_date DATE,
      amount REAL,
      tax_amount REAL,
      total_amount REAL,
      seller_name TEXT,
      seller_tax_no TEXT,
      buyer_name TEXT,
      buyer_tax_no TEXT,
      category TEXT,
      image_url TEXT,
      ocr_result TEXT,
      status TEXT DEFAULT 'pending',
      employee_id TEXT,
      employee_name TEXT,
      department TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS duplicate_invoices (
      id TEXT PRIMARY KEY,
      original_invoice_id TEXT NOT NULL,
      duplicate_invoice_id TEXT NOT NULL,
      duplicate_type TEXT,
      confidence REAL,
      status TEXT DEFAULT 'pending',
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (original_invoice_id) REFERENCES invoice_images(id),
      FOREIGN KEY (duplicate_invoice_id) REFERENCES invoice_images(id)
    )`,
    `CREATE TABLE IF NOT EXISTS match_results (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      reimbursement_id TEXT,
      trip_id TEXT,
      budget_category_id TEXT,
      match_type TEXT,
      match_score REAL,
      status TEXT DEFAULT 'pending',
      matched_by TEXT,
      matched_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoice_images(id),
      FOREIGN KEY (reimbursement_id) REFERENCES reimbursement_forms(id),
      FOREIGN KEY (trip_id) REFERENCES trip_records(id),
      FOREIGN KEY (budget_category_id) REFERENCES budget_categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS status_timeline (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL,
      previous_status TEXT,
      operator TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`表 ${index + 1} 创建失败:`, err.message);
      }
    });
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export default db;
