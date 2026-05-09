const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'repair-service.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let isInitialized = false;
let inTransaction = false;

async function initDatabase() {
  if (isInitialized) return;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  initSchema();
  saveDatabase();
  isInitialized = true;
}

function waitForInit() {
  return new Promise((resolve) => {
    const check = () => {
      if (isInitialized) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function saveDatabase() {
  if (!db || inTransaction) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS repair_orders (
      id TEXT PRIMARY KEY,
      product_sn TEXT NOT NULL,
      product_name TEXT NOT NULL,
      repair_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      current_responsibility TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS liability_freezes (
      id TEXT PRIMARY KEY,
      repair_order_id TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      reason TEXT,
      frozen_at INTEGER NOT NULL,
      frozen_by TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evidence_attachments (
      id TEXT PRIMARY KEY,
      repair_order_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      uploaded_by TEXT,
      uploaded_at INTEGER NOT NULL,
      description TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rejudge_records (
      id TEXT PRIMARY KEY,
      repair_order_id TEXT NOT NULL,
      previous_responsibility TEXT,
      new_responsibility TEXT,
      reason TEXT NOT NULL,
      operator TEXT,
      operated_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      approver TEXT,
      approved_at INTEGER,
      approve_comment TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cost_records (
      id TEXT PRIMARY KEY,
      repair_order_id TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      cost_type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      description TEXT,
      recorded_at INTEGER NOT NULL,
      recorded_by TEXT,
      is_settled INTEGER NOT NULL DEFAULT 0,
      settled_at INTEGER,
      settlement_batch TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settlement_batches (
      id TEXT PRIMARY KEY,
      responsibility TEXT NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      cost_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING'
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      operator TEXT,
      operated_at INTEGER NOT NULL,
      details TEXT,
      ip_address TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resource_locks (
      resource_key TEXT PRIMARY KEY,
      lock_holder TEXT,
      locked_at INTEGER,
      expires_at INTEGER
    );
  `);
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      if (!inTransaction) {
        saveDatabase();
      }
      return { changes: db.getRowsModified() };
    },
    get: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.free();
        return result;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDatabase();
}

function runTransaction(fn) {
  if (inTransaction) {
    return fn();
  }
  
  inTransaction = true;
  let result;
  try {
    db.run('BEGIN TRANSACTION');
    result = fn();
    db.run('COMMIT');
    saveDatabase();
  } catch (e) {
    try {
      db.run('ROLLBACK');
    } catch (rollbackError) {
      console.warn('Rollback failed:', rollbackError.message);
    }
    throw e;
  } finally {
    inTransaction = false;
  }
  return result;
}

module.exports = {
  initDatabase,
  waitForInit,
  prepare,
  exec,
  runTransaction
};
