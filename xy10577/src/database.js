const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'voucher.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance = null;
let SQL = null;

const saveDb = () => {
  if (dbInstance) {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const initTables = () => {
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      budget_amount REAL NOT NULL DEFAULT 0,
      used_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stalls (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      location TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitor_appointments (
      id TEXT PRIMARY KEY,
      visitor_name TEXT NOT NULL,
      visitor_phone TEXT,
      visitor_company TEXT,
      host_department_id TEXT NOT NULL,
      host_name TEXT,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      actual_arrival_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_vouchers (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      voucher_code TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL DEFAULT 50.00,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ISSUED',
      issued_by TEXT,
      issued_at TEXT NOT NULL,
      voided_by TEXT,
      voided_at TEXT,
      void_reason TEXT,
      expired_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY,
      voucher_id TEXT NOT NULL UNIQUE,
      stall_id TEXT NOT NULL,
      redeemed_at TEXT NOT NULL,
      redeemed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT,
      reason TEXT,
      before_state TEXT,
      after_state TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS failed_operations (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      request_id TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      error_code TEXT NOT NULL,
      error_message TEXT NOT NULL,
      request_data TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      entity_id TEXT,
      response_data TEXT,
      created_at TEXT NOT NULL
    );
  `);
};

const wrapDb = (database) => {
  return {
    prepare: (sql) => {
      return {
        run: (...params) => {
          database.run(sql, params);
          saveDb();
          return { changes: database.getRowsModified() };
        },
        get: (...params) => {
          const stmt = database.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        },
        all: (...params) => {
          const stmt = database.prepare(sql);
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        }
      };
    },
    exec: (sql) => {
      database.run(sql);
      saveDb();
    },
    pragma: () => {},
    transaction: (fn) => {
      return (...args) => {
        database.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          database.run('COMMIT');
          saveDb();
          return result;
        } catch (e) {
          database.run('ROLLBACK');
          throw e;
        }
      };
    }
  };
};

const initSync = () => {
  if (dbInstance) return wrapDb(dbInstance);
  throw new Error('数据库未初始化，请先调用 initDb()');
};

const initDb = async () => {
  if (dbInstance) return wrapDb(dbInstance);
  
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }
  
  initTables();
  saveDb();
  
  return wrapDb(dbInstance);
};

module.exports = {
  initDb,
  getDb: () => wrapDb(dbInstance),
  isReady: () => dbInstance !== null
};
