const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'milk-bank.db');

let SQL = null;
let dbInstance = null;
let inMemory = process.env.DB_PATH === ':memory:';

async function ensureDbReady() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  let rawDb;

  if (inMemory) {
    rawDb = new SQL.Database();
  } else if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  dbInstance = new SqlJsWrapper(rawDb);
  initTables(dbInstance);
  
  if (!inMemory) {
    saveDbInternal(dbInstance);
  }

  return dbInstance;
}

function initTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_id TEXT NOT NULL,
      donation_date TEXT NOT NULL,
      quantity_ml INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_test',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL,
      test_type TEXT NOT NULL,
      result TEXT NOT NULL,
      test_date TEXT NOT NULL,
      tested_by TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS frozen_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT NOT NULL UNIQUE,
      donation_id TEXT NOT NULL,
      volume_ml INTEGER NOT NULL,
      container_type TEXT NOT NULL,
      container_count INTEGER NOT NULL,
      freeze_date TEXT NOT NULL,
      freezer_location TEXT NOT NULL,
      freezer_level TEXT,
      status TEXT NOT NULL DEFAULT 'frozen',
      expiry_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS distribution_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      distributed_quantity_ml INTEGER NOT NULL,
      containers_used INTEGER NOT NULL,
      distribution_date TEXT NOT NULL,
      verified_by TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recall_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      recall_date TEXT NOT NULL,
      recalled_quantity_ml INTEGER,
      recalled_containers INTEGER,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotent_requests (
      request_id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function saveDbInternal(database) {
  if (inMemory) return;
  const data = database.getRaw().export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

class SqlJsWrapper {
  constructor(rawDb) {
    this._rawDb = rawDb;
  }

  getRaw() {
    return this._rawDb;
  }

  prepare(sql) {
    return new StatementWrapper(this, sql);
  }

  exec(sql) {
    this._rawDb.run(sql);
    saveDbInternal(this);
  }

  pragma() {
    return [];
  }

  close() {
    saveDbInternal(this);
    this._rawDb.close();
    dbInstance = null;
  }
}

class StatementWrapper {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
  }

  run(...params) {
    try {
      this.database.getRaw().run(this.sql, params);
      saveDbInternal(this.database);
      return { changes: 0, lastInsertRowid: null };
    } catch (e) {
      throw new Error(e.message);
    }
  }

  get(...params) {
    const stmt = this.database.getRaw().prepare(this.sql);
    try {
      stmt.bind(params);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        return result;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params) {
    const stmt = this.database.getRaw().prepare(this.sql);
    try {
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }
}

function getDbSync() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call ensureDbReady() first.');
  }
  return dbInstance;
}

async function closeDb() {
  if (dbInstance) {
    dbInstance.close();
  }
}

async function resetDb() {
  if (dbInstance) {
    dbInstance.close();
  }
  if (!inMemory && fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  SQL = null;
  dbInstance = null;
  return ensureDbReady();
}

module.exports = {
  ensureDbReady,
  getDbSync,
  closeDb,
  resetDb,
  DB_PATH
};
