const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'invoice-review.db');

let db;

const INVOICE_STATUSES = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  EXCEPTION: 'exception',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const EXCEPTION_TYPES = {
  AMOUNT_MISMATCH: 'amount_mismatch',
  TAX_NUMBER_INVALID: 'tax_number_invalid',
  APPROVAL_MISSING: 'approval_missing',
  IMAGE_CLEARNESS: 'image_clearness',
  DUPLICATE: 'duplicate',
  OTHER: 'other'
};

function init() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
      } else {
        console.log('已连接到 SQLite 数据库');
        createTables()
          .then(() => {
            console.log('数据库表初始化完成');
            resolve();
          })
          .catch(reject);
      }
    });
  });
}

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      invoice_date TEXT,
      amount REAL,
      tax_amount REAL,
      tax_number TEXT,
      vendor_name TEXT,
      vendor_tax_number TEXT,
      approval_amount REAL,
      approver_name TEXT,
      approval_date TEXT,
      approval_comments TEXT,
      image_path TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      exception_count INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_history (
      id TEXT PRIMARY KEY,
      invoice_id TEXT,
      action TEXT,
      old_values TEXT,
      new_values TEXT,
      operator TEXT,
      notes TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      invoice_id TEXT,
      type TEXT,
      field TEXT,
      expected_value TEXT,
      actual_value TEXT,
      description TEXT,
      status TEXT DEFAULT 'open',
      assignee TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      resolution_notes TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS review_reports (
      id TEXT PRIMARY KEY,
      report_type TEXT,
      title TEXT,
      filters TEXT,
      summary TEXT,
      generated_at TEXT,
      generated_by TEXT,
      invoice_ids TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_history_invoice ON invoice_history(invoice_id)`,
    `CREATE INDEX IF NOT EXISTS idx_exceptions_invoice ON exceptions(invoice_id)`
  ];

  for (const sql of statements) {
    await new Promise((resolve, reject) => {
      db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  init,
  run,
  get,
  all,
  INVOICE_STATUSES,
  EXCEPTION_TYPES
};
