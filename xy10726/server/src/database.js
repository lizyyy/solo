const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

const dbFile = path.join(dbPath, 'invoices.db');
let db;

function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('数据库连接成功');
      
      createTables().then(resolve).catch(reject);
    });
  });
}

function createTables() {
  return Promise.all([
    run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT,
        invoice_code TEXT,
        tax_number TEXT,
        amount REAL,
        invoice_date TEXT,
        seller_name TEXT,
        buyer_name TEXT,
        image_path TEXT,
        status TEXT DEFAULT 'pending',
        confidence REAL,
        ocr_raw TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        idempotency_key TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id TEXT,
        action TEXT,
        status_from TEXT,
        status_to TEXT,
        operator TEXT,
        reason TEXT,
        fields_changed TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS duplicates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id TEXT,
        duplicate_with TEXT,
        reason TEXT,
        resolved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (duplicate_with) REFERENCES invoices(id)
      )
    `),
    run(`
      CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        filename TEXT,
        file_path TEXT,
        record_count INTEGER,
        total_amount REAL,
        status TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),
    run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`),
    run(`CREATE INDEX IF NOT EXISTS idx_invoices_tax ON invoices(tax_number)`),
    run(`CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)`),
    run(`CREATE INDEX IF NOT EXISTS idx_audit_invoice ON audit_logs(invoice_id)`)
  ]);
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { init, run, get, all, db };
