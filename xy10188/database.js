const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, 'cold_chain.db');

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sign_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      driver_name TEXT NOT NULL,
      warehouse_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      sign_time TEXT NOT NULL,
      expected_temp_min REAL NOT NULL,
      expected_temp_max REAL NOT NULL,
      actual_temp REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      is_abnormal INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS temp_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      temp REAL NOT NULL,
      source TEXT NOT NULL,
      uploader TEXT NOT NULL,
      upload_time TEXT NOT NULL,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS responsibility_transfer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      from_role TEXT NOT NULL,
      from_user TEXT NOT NULL,
      to_role TEXT NOT NULL,
      to_user TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transfer_time TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supplementary_review (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      submitter TEXT NOT NULL,
      submit_role TEXT NOT NULL,
      content TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      review_remark TEXT,
      review_time TEXT,
      submit_time TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trace_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER UNIQUE NOT NULL,
      report_no TEXT UNIQUE NOT NULL,
      root_cause TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      action_plan TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      generated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  saveDb();
  return db;
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function rowToObject(stmt) {
  const columns = stmt.getColumnNames();
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  return results;
}

function getLastInsertId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0][0];
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  return rowToObject(stmt);
}

function get(sql, params = []) {
  const results = all(sql, params);
  return results[0] || null;
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDb();
      return { lastInsertRowid: getLastInsertId() };
    },
    get: function(...params) {
      const results = all(sql, params);
      return results[0] || null;
    },
    all: function(...params) {
      return all(sql, params);
    }
  };
}

module.exports = {
  initDb,
  run,
  all,
  get,
  prepare,
  saveDb
};
