const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

let db;
let SQL;

async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();
  
  const dbPath = config.database.path;
  const dbExists = fs.existsSync(dbPath);

  if (dbExists) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    logger.info('已加载现有数据库', { path: dbPath });
  } else {
    db = new SQL.Database();
    logger.info('创建新数据库', { path: dbPath });
  }

  initializeTables(db);
  
  if (!dbExists) {
    saveDatabase();
  }

  return db;
}

function getConnection() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return db;
}

function saveDatabase() {
  if (!db) return;
  
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(config.database.path, buffer);
  } catch (err) {
    logger.error('保存数据库失败', { error: err.message });
  }
}

function initializeTables(db) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    `CREATE TABLE IF NOT EXISTS permission_matrix (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_level TEXT NOT NULL,
      action TEXT NOT NULL,
      is_allowed INTEGER DEFAULT 1,
      category TEXT,
      max_amount REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    `CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_code TEXT NOT NULL UNIQUE,
      category_name TEXT NOT NULL,
      is_refundable INTEGER DEFAULT 1,
      max_refund_ratio REAL DEFAULT 1,
      special_approval_required INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    `CREATE TABLE IF NOT EXISTS refund_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_level TEXT NOT NULL,
      category TEXT,
      max_amount REAL NOT NULL,
      effective_from INTEGER DEFAULT (strftime('%s', 'now')),
      effective_to INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    `CREATE TABLE IF NOT EXISTS refund_requests (
      id TEXT PRIMARY KEY,
      request_no TEXT UNIQUE NOT NULL,
      order_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'CNY',
      reason TEXT NOT NULL,
      initiator_id TEXT NOT NULL,
      initiator_level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      parent_request_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    `CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      refund_request_id TEXT NOT NULL,
      approver_level TEXT NOT NULL,
      approver_id TEXT,
      action TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT,
      operator_level TEXT,
      target_type TEXT NOT NULL,
      target_id TEXT,
      before_value TEXT,
      after_value TEXT,
      result TEXT NOT NULL,
      detail TEXT,
      ip_address TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`
  ];

  tables.forEach(sql => db.run(sql));

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_refund_request_no ON refund_requests(request_no)',
    'CREATE INDEX IF NOT EXISTS idx_refund_order ON refund_requests(order_id)',
    'CREATE INDEX IF NOT EXISTS idx_approval_refund ON approval_requests(refund_request_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_logs(operation_type, created_at)'
  ];

  indexes.forEach(sql => {
    try {
      db.run(sql);
    } catch (err) {
    }
  });

  saveDatabase();
}

class StatementWrapper {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  run(...args) {
    let params = args;
    if (args.length === 1 && Array.isArray(args[0])) {
      params = args[0];
    }
    
    this.db.run(this.sql, params);
    saveDatabase();
    
    const result = {
      changes: this.db.getRowsModified()
    };
    
    if (this.sql.trim().toUpperCase().startsWith('INSERT')) {
      const results = this.db.exec('SELECT last_insert_rowid() as lastId');
      if (results.length > 0 && results[0].values.length > 0) {
        result.lastInsertRowid = results[0].values[0][0];
      }
    }
    
    return result;
  }

  get(...args) {
    let params = args;
    if (args.length === 1 && Array.isArray(args[0])) {
      params = args[0];
    }
    
    const results = this.db.exec(this.sql, params);
    
    if (results.length === 0 || results[0].values.length === 0) {
      return undefined;
    }
    
    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = {};
    
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    
    return row;
  }

  all(...args) {
    let params = args;
    if (args.length === 1 && Array.isArray(args[0])) {
      params = args[0];
    }
    
    const results = this.db.exec(this.sql, params);
    
    if (results.length === 0) {
      return [];
    }
    
    const columns = results[0].columns;
    const rows = [];
    
    results[0].values.forEach(values => {
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      rows.push(row);
    });
    
    return rows;
  }
}

function prepare(sql) {
  const db = getConnection();
  return new StatementWrapper(db, sql);
}

function exec(sql) {
  const db = getConnection();
  const statements = sql.split(';').filter(s => s.trim());
  
  statements.forEach(stmt => {
    if (stmt.trim()) {
      db.run(stmt.trim() + ';');
    }
  });
  
  saveDatabase();
}

function runTransaction(callback) {
  const db = getConnection();
  
  db.run('BEGIN TRANSACTION');
  
  try {
    const result = callback();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

module.exports = {
  initDatabase,
  getConnection,
  prepare,
  exec,
  runTransaction,
  saveDatabase
};
