const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

let db = null;

async function initDatabase() {
  if (db) {
    return false;
  }

  const dbDir = path.dirname(config.database.file);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  
  let isFirstRun = true;
  if (fs.existsSync(config.database.file)) {
    try {
      const fileBuffer = fs.readFileSync(config.database.file);
      db = new SQL.Database(fileBuffer);
      isFirstRun = false;
    } catch (e) {
      console.log('⚠ 数据库文件损坏，重新创建');
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS beds (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      bed_number TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT,
      gender TEXT,
      age INTEGER,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transfer_requests (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE,
      patient_id TEXT NOT NULL,
      from_hospital_id TEXT,
      to_hospital_id TEXT NOT NULL,
      to_department_id TEXT NOT NULL,
      severity_level TEXT NOT NULL,
      urgency_score INTEGER,
      diagnosis TEXT,
      current_status TEXT DEFAULT 'pending',
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      cancelled_at DATETIME,
      completed_at DATETIME,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      bed_id TEXT,
      scheduled_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      confirmed_at DATETIME,
      cancelled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS waiting_queue (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      priority_score INTEGER,
      queue_position INTEGER,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      reason TEXT,
      diff_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      exception_type TEXT NOT NULL,
      message TEXT NOT NULL,
      resolved_at DATETIME,
      resolved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDatabase();

  if (isFirstRun) {
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const hasHospitals = tables.length > 0 && tables[0].values.some(r => r[0] === 'hospitals');
    const count = db.exec("SELECT COUNT(*) as cnt FROM hospitals");
    if (count.length === 0 || count[0].values[0][0] === 0) {
      isFirstRun = true;
    } else {
      isFirstRun = false;
    }
  }
  
  return isFirstRun;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.database.file, buffer);
  }
}

function getDb() {
  return db;
}

const dbWrapper = {
  prepare: function(sql) {
    const stmt = {
      sql,
      run: function(...params) {
        db.run(sql, params);
        saveDatabase();
        return { changes: db.getRowsModified() };
      },
      get: function(...params) {
        const results = db.exec(sql, params);
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
      },
      all: function(...params) {
        const results = db.exec(sql, params);
        if (results.length === 0) {
          return [];
        }
        const columns = results[0].columns;
        return results[0].values.map(row => {
          const obj = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      }
    };
    return stmt;
  },
  exec: function(sql, params = []) {
    const results = db.exec(sql, params);
    saveDatabase();
    return results.map(r => ({
      columns: r.columns,
      values: r.values
    }));
  },
  run: function(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
    return { changes: db.getRowsModified() };
  }
};

function transaction(fn) {
  return function(...args) {
    db.run('BEGIN TRANSACTION');
    try {
      const result = fn.apply(null, args);
      db.run('COMMIT');
      saveDatabase();
      return result;
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  };
}

module.exports = {
  db: dbWrapper,
  initDatabase,
  getDb,
  transaction
};
