const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let db = null;
let SQL = null;
let dbPath = null;

async function initDb() {
  if (db && SQL) return { db, SQL };
  
  SQL = await initSqlJs();
  dbPath = path.resolve(config.dbPath);
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  initTables();
  saveDb();
  
  return { db, SQL };
}

function saveDb() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDb()');
  }
  return db;
}

function getSqlJs() {
  return SQL;
}

function initTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_no TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      amount_currency TEXT DEFAULT 'CNY',
      party_a TEXT NOT NULL,
      party_b TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seal_applications (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE,
      contract_id TEXT NOT NULL,
      seal_type TEXT NOT NULL,
      applicant TEXT NOT NULL,
      department TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL,
      current_approver_index INTEGER DEFAULT 0,
      total_approvers INTEGER DEFAULT 0,
      is_withdrawn INTEGER DEFAULT 0,
      withdrawn_at DATETIME,
      withdrawn_by TEXT,
      withdraw_reason TEXT,
      original_application_id TEXT,
      resubmit_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS approval_chains (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      approver_order INTEGER NOT NULL,
      approver TEXT NOT NULL,
      role TEXT,
      status TEXT DEFAULT 'PENDING',
      approved_at DATETIME,
      rejected_at DATETIME,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS field_change_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_scan_results (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      rule_name TEXT NOT NULL,
      rule_description TEXT,
      risk_level TEXT NOT NULL,
      is_pass INTEGER NOT NULL,
      risk_reason TEXT,
      suggestion TEXT
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      idempotency_key TEXT PRIMARY KEY,
      request_type TEXT NOT NULL,
      response_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seal_confirmations (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      sealed_by TEXT NOT NULL,
      seal_count INTEGER DEFAULT 1,
      seal_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT
    );
  `;

  db.run(sql);
}

function runQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.getAsObject();
  stmt.free();
  saveDb();
  return result;
}

function runExec(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function runAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function runGet(sql, params = []) {
  const results = runAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

module.exports = {
  initDb,
  getDb,
  getSqlJs,
  saveDb,
  runQuery,
  runExec,
  runAll,
  runGet,
  initTables,
};
