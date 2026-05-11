const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;
const dbPath = path.join(__dirname, 'sla_fine.db');

async function initializeDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    db = new SQL.Database(data);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      contract_number TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      response_sla_hours INTEGER NOT NULL DEFAULT 4,
      repair_sla_hours INTEGER NOT NULL DEFAULT 8,
      response_fine_rate REAL NOT NULL DEFAULT 50,
      repair_fine_rate REAL NOT NULL DEFAULT 80,
      max_response_fine REAL DEFAULT NULL,
      max_repair_fine REAL DEFAULT NULL,
      max_total_fine REAL DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      work_order_number TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      is_settled INTEGER DEFAULT 0,
      settled_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    );

    CREATE TABLE IF NOT EXISTS timing_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_time TEXT NOT NULL,
      reason TEXT,
      evidence_url TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    CREATE TABLE IF NOT EXISTS exemption_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      exemption_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_url TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_number TEXT NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_response_fine REAL DEFAULT 0,
      total_repair_fine REAL DEFAULT 0,
      total_fine REAL DEFAULT 0,
      total_exempted REAL DEFAULT 0,
      net_fine REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settlement_work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_id INTEGER NOT NULL,
      work_order_id INTEGER NOT NULL,
      response_fine REAL DEFAULT 0,
      repair_fine REAL DEFAULT 0,
      exempted_amount REAL DEFAULT 0,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    )
  `);

  saveDatabase();
  console.log('数据库初始化完成');
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function Statement(sql) {
  this.sql = sql;
}

Statement.prototype.run = function(...params) {
  const stmt = db.prepare(this.sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  stmt.step();
  stmt.free();
  
  const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
  const changesResult = db.exec('SELECT changes() as changes');
  
  saveDatabase();
  
  return {
    lastInsertRowid: lastIdResult && lastIdResult[0] && lastIdResult[0].values[0] ? lastIdResult[0].values[0][0] : null,
    changes: changesResult && changesResult[0] && changesResult[0].values[0] ? changesResult[0].values[0][0] : 0
  };
};

Statement.prototype.get = function(...params) {
  const stmt = db.prepare(this.sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
};

Statement.prototype.all = function(...params) {
  const stmt = db.prepare(this.sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

const database = {
  prepare: function(sql) {
    return new Statement(sql);
  },
  
  exec: function(sql) {
    db.run(sql);
    saveDatabase();
  },
  
  run: function(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    saveDatabase();
  },
  
  transaction: function(fn) {
    return function(...args) {
      return fn(...args);
    };
  }
};

module.exports = {
  db: database,
  initializeDatabase,
  prepare: database.prepare,
  run: database.run,
  exec: database.exec
};
