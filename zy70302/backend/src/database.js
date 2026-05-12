const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'dead_letter.db');

let db = null;
let SQL = null;

const loadDatabase = async () => {
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      task_name TEXT NOT NULL,
      business_no TEXT,
      payload TEXT NOT NULL,
      original_payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retry INTEGER NOT NULL DEFAULT 3,
      idempotent_key TEXT,
      has_side_effect INTEGER NOT NULL DEFAULT 0,
      side_effect_type TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dead_letters (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      error_category TEXT,
      payload_snapshot TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      need_manual INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS replay_history (
      id TEXT PRIMARY KEY,
      dead_letter_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      idempotent_key TEXT NOT NULL,
      payload_before TEXT NOT NULL,
      payload_after TEXT NOT NULL,
      diff TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error_message TEXT,
      operator TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payload_modifications (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      dead_letter_id TEXT,
      payload_before TEXT NOT NULL,
      payload_after TEXT NOT NULL,
      diff TEXT NOT NULL,
      safe_fields TEXT,
      operator TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_snapshots (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      replay_history_id TEXT,
      business_type TEXT NOT NULL,
      business_no TEXT NOT NULL,
      snapshot_before TEXT,
      snapshot_after TEXT,
      diff TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mock_invoices (
      id TEXT PRIMARY KEY,
      business_no TEXT UNIQUE NOT NULL,
      invoice_no TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      amount REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mock_sms (
      id TEXT PRIMARY KEY,
      business_no TEXT UNIQUE NOT NULL,
      phone TEXT,
      content TEXT,
      sent_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mock_inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT UNIQUE NOT NULL,
      product_name TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mock_inventory_logs (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      business_no TEXT,
      change INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  saveDatabase();
};

const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

class StatementWrapper {
  constructor(sql) {
    this.sql = sql;
  }

  run(...params) {
    db.run(this.sql, params);
    saveDatabase();
    return { changes: db.getRowsModified() };
  }

  get(...params) {
    const stmt = db.prepare(this.sql);
    stmt.bind(params);
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const results = [];
    const stmt = db.prepare(this.sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

const dbWrapper = {
  prepare: (sql) => new StatementWrapper(sql),
  run: (sql, params = []) => {
    db.run(sql, params);
    saveDatabase();
  },
  exec: (sql) => {
    db.run(sql);
    saveDatabase();
  },
  get: (sql, params = []) => {
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
  all: (sql, params = []) => {
    const results = [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },
  pragma: () => {}
};

module.exports = dbWrapper;
module.exports.loadDatabase = loadDatabase;
