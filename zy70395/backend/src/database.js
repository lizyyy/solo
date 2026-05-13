const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'billing.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL`);

  const createTables = [
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS discount_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      priority INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      bill_month TEXT NOT NULL,
      original_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS bill_versions (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      rule_id TEXT,
      rule_name TEXT,
      discount_type TEXT,
      discount_value REAL,
      applied_discount REAL NOT NULL,
      final_amount REAL NOT NULL,
      is_paid INTEGER DEFAULT 0,
      paid_at TEXT,
      is_active INTEGER DEFAULT 0,
      reason TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      UNIQUE(bill_id, version_number)
    )`,
    `CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      bill_version_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      item_amount REAL NOT NULL,
      FOREIGN KEY (bill_version_id) REFERENCES bill_versions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS bill_anomalies (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      anomaly_type TEXT NOT NULL,
      anomaly_reason TEXT NOT NULL,
      detected_by TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (version_id) REFERENCES bill_versions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS correction_requests (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      anomaly_id TEXT,
      source_version_id TEXT NOT NULL,
      target_rule_id TEXT,
      target_rule_name TEXT,
      trial_result REAL,
      trial_final_amount REAL,
      correction_type TEXT NOT NULL,
      adjustment_amount REAL,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (anomaly_id) REFERENCES bill_anomalies(id)
    )`,
    `CREATE TABLE IF NOT EXISTS correction_approvals (
      id TEXT PRIMARY KEY,
      correction_request_id TEXT NOT NULL,
      approver TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      approved_at TEXT NOT NULL,
      FOREIGN KEY (correction_request_id) REFERENCES correction_requests(id)
    )`,
    `CREATE TABLE IF NOT EXISTS customer_notifications (
      id TEXT PRIMARY KEY,
      correction_request_id TEXT NOT NULL,
      bill_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT,
      error_message TEXT,
      content TEXT,
      FOREIGN KEY (correction_request_id) REFERENCES correction_requests(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS version_rollbacks (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      rolled_back_version_id TEXT NOT NULL,
      restored_version_id TEXT NOT NULL,
      reason TEXT,
      rolled_back_by TEXT NOT NULL,
      rolled_back_at TEXT NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (rolled_back_version_id) REFERENCES bill_versions(id),
      FOREIGN KEY (restored_version_id) REFERENCES bill_versions(id)
    )`
  ];

  for (const sql of createTables) {
    db.run(sql);
  }
});

function prepare(sql) {
  const stmt = db.prepare(sql);
  
  const originalRun = stmt.run.bind(stmt);
  stmt.run = function(...args) {
    return new Promise((resolve, reject) => {
      originalRun(...args, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };
  
  const originalAll = stmt.all.bind(stmt);
  stmt.all = function(...args) {
    return new Promise((resolve, reject) => {
      originalAll(...args, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };
  
  const originalGet = stmt.get.bind(stmt);
  stmt.get = function(...args) {
    return new Promise((resolve, reject) => {
      originalGet(...args, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };
  
  return stmt;
}

db.prepare = prepare;

db.runAsync = function(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

db.allAsync = function(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

db.getAsync = function(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.get(sql, ...params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.execAsync = function(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = db;
