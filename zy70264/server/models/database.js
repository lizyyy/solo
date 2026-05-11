const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/tracker.db');

let db = null;

function wrapStatement(stmt) {
  return {
    run: function(...params) {
      const result = stmt.run(params);
      saveDatabase();
      return result;
    },
    get: function(...params) {
      stmt.bind(params);
      const result = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return result;
    },
    all: function(...params) {
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

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      total_meals INTEGER NOT NULL DEFAULT 0,
      delivered_meals INTEGER NOT NULL DEFAULT 0,
      returned_meals INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      distributor TEXT,
      vehicle_no TEXT,
      departure_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS temperature_segments (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      segment_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      avg_temp REAL,
      min_temp REAL,
      max_temp REAL,
      temp_records TEXT,
      is_normal INTEGER DEFAULT 1,
      abnormal_reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sign_receipts (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      elderly_id TEXT NOT NULL,
      elderly_name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      sign_time TEXT,
      sign_type TEXT NOT NULL DEFAULT 'normal',
      meals_received INTEGER DEFAULT 0,
      signer_name TEXT,
      signature TEXT,
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS return_reasons (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      return_type TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      reason_detail TEXT,
      meals_returned INTEGER DEFAULT 0,
      return_time TEXT,
      photos TEXT,
      operator TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_rules (
      id TEXT PRIMARY KEY,
      rule_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_condition TEXT NOT NULL,
      compensation_type TEXT NOT NULL,
      compensation_amount REAL DEFAULT 0,
      compensation_percent REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensations (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      receipt_id TEXT,
      return_id TEXT,
      rule_id TEXT,
      elderly_id TEXT,
      elderly_name TEXT,
      compensation_type TEXT NOT NULL,
      compensation_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      approval_time TEXT,
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS safety_incidents (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      affected_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      reporter TEXT,
      created_at TEXT NOT NULL
    );
  `);

  saveDatabase();

  const originalPrepare = db.prepare.bind(db);
  db.prepare = function(sql) {
    const stmt = originalPrepare(sql);
    return wrapStatement(stmt);
  };

  const originalRun = db.run.bind(db);
  db.run = function(...args) {
    const result = originalRun(...args);
    saveDatabase();
    return result;
  };

  const originalExec = db.exec.bind(db);
  db.exec = function(sql) {
    originalExec(sql);
    saveDatabase();
  };

  return db;
}

const initPromise = initDatabase();

module.exports = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'ready') {
      return initPromise;
    }
    
    if (!db) {
      throw new Error('数据库尚未初始化，请等待 initDatabase() 完成');
    }
    
    if (typeof db[prop] === 'function') {
      return db[prop].bind(db);
    }
    return db[prop];
  }
});
