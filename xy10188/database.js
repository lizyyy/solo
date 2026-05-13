const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let nativeDb = null;
const dbPath = path.join(__dirname, 'cold_chain.db');

function now() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function saveDb() {
  const data = nativeDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function stmtRun(sql, params = []) {
  const stmt = nativeDb.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDb();
  
  const result = nativeDb.exec('SELECT last_insert_rowid() as id, changes() as changes');
  const lastInsertRowid = result[0]?.values?.[0]?.[0] || 0;
  const changes = result[0]?.values?.[0]?.[1] || 0;
  return { lastInsertRowid, changes };
}

function stmtAll(sql, params = []) {
  const stmt = nativeDb.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function stmtGet(sql, params = []) {
  const results = stmtAll(sql, params);
  return results[0] || null;
}

function createPreparedStatement(sql) {
  return {
    run: function(...params) {
      return stmtRun(sql, params);
    },
    get: function(...params) {
      return stmtGet(sql, params);
    },
    all: function(...params) {
      return stmtAll(sql, params);
    }
  };
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    nativeDb = new SQL.Database(fileBuffer);
  } else {
    nativeDb = new SQL.Database();
  }

  const currentTime = now();

  nativeDb.run(`
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  nativeDb.run(`
    CREATE TABLE IF NOT EXISTS temp_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      temp REAL NOT NULL,
      source TEXT NOT NULL,
      uploader TEXT NOT NULL,
      upload_time TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL
    )
  `);

  nativeDb.run(`
    CREATE TABLE IF NOT EXISTS responsibility_transfer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      from_role TEXT NOT NULL,
      from_user TEXT NOT NULL,
      to_role TEXT NOT NULL,
      to_user TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transfer_time TEXT NOT NULL
    )
  `);

  nativeDb.run(`
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
      submit_time TEXT NOT NULL
    )
  `);

  nativeDb.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  nativeDb.run(`
    CREATE TABLE IF NOT EXISTS trace_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER UNIQUE NOT NULL,
      report_no TEXT UNIQUE NOT NULL,
      root_cause TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      action_plan TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      generated_at TEXT NOT NULL
    )
  `);

  nativeDb.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )
  `);

  saveDb();

  return {
    prepare: function(sql) {
      return createPreparedStatement(sql);
    },
    run: function(sql, params = []) {
      return stmtRun(sql, params);
    },
    get: function(sql, params = []) {
      return stmtGet(sql, params);
    },
    all: function(sql, params = []) {
      return stmtAll(sql, params);
    },
    exec: function(sql) {
      return nativeDb.exec(sql);
    },
    _native: nativeDb,
    save: saveDb
  };
}

module.exports = {
  initDb
};
