const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db;
let dbFilePath;

function getNow() {
  return new Date().toISOString();
}

class DatabaseWrapper {
  constructor(sqlDb) {
    this.db = sqlDb;
    this.inTransaction = false;
  }
  
  replaceDateTimeNow(sql) {
    return sql.replace(/datetime\('now'\)/g, `'${getNow()}'`);
  }
  
  prepare(sql) {
    const processedSql = this.replaceDateTimeNow(sql);
    const stmt = this.db.prepare(processedSql);
    const self = this;
    
    return {
      run: (...params) => {
        stmt.bind(params);
        stmt.step();
        stmt.free();
        if (!self.inTransaction) {
          self.save();
        }
        return { changes: self.db.getRowsModified() };
      },
      get: (...params) => {
        stmt.bind(params);
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      },
      all: (...params) => {
        const results = [];
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }
  
  exec(sql) {
    const processedSql = this.replaceDateTimeNow(sql);
    this.db.run(processedSql);
    if (!this.inTransaction) {
      this.save();
    }
  }
  
  pragma(sql) {
  }
  
  transaction(fn) {
    return fn;
  }
  
  save() {
    if (dbFilePath) {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbFilePath, buffer);
      } catch (e) {
        console.warn('保存数据库失败:', e.message);
      }
    }
  }
}

async function initDB() {
  const SQL = await initSqlJs();
  dbFilePath = path.join(__dirname, '../../data/aftersales.db');
  const dbDir = path.dirname(dbFilePath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  let sqlDb;
  if (fs.existsSync(dbFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(dbFilePath);
      sqlDb = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('数据库文件损坏，创建新数据库:', e.message);
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }
  
  db = new DatabaseWrapper(sqlDb);
  
  createTables();
  
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      part_code TEXT UNIQUE NOT NULL,
      part_name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT '个',
      price REAL DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      location TEXT,
      min_stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS engineers (
      id TEXT PRIMARY KEY,
      engineer_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      order_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_contact TEXT,
      issue_type TEXT,
      status TEXT DEFAULT 'open',
      closed_at TEXT,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      loan_code TEXT UNIQUE NOT NULL,
      part_id TEXT NOT NULL,
      engineer_id TEXT NOT NULL,
      work_order_id TEXT,
      quantity INTEGER NOT NULL,
      borrowed_at TEXT NOT NULL,
      expected_return_at TEXT,
      actual_return_at TEXT,
      status TEXT DEFAULT 'borrowed',
      loan_reason TEXT,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS loan_items (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      action_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      work_order_id TEXT,
      damage_level TEXT,
      compensation_amount REAL,
      created_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      request_hash TEXT NOT NULL,
      response TEXT,
      created_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before_value TEXT,
      after_value TEXT,
      operator TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT ''
    );
  `);
}

function getDB() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

module.exports = { initDB, getDB, getNow };
