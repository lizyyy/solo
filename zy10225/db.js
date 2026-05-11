const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { DEFAULT_DB_PATH, DEFAULT_CONFIG_PATH, SETTLEMENT_STATUS } = require('./config');

let dbInstance = null;
let SQL = null;

async function initSqlJsModule() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

async function getDb(dbPath = DEFAULT_DB_PATH) {
  if (dbInstance) {
    return dbInstance;
  }
  
  const SQL = await initSqlJsModule();
  const dir = path.dirname(dbPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  let db;
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  dbInstance = {
    db,
    dbPath,
    SQL,
    
    prepare(sql) {
      const self = this;
      return {
        run(...params) {
          db.run(sql, params);
          if (!self._inTransaction) {
            saveDatabase(db, dbPath);
          }
        },
        get(...params) {
          const result = db.exec(sql, params);
          if (result.length === 0 || result[0].values.length === 0) {
            return undefined;
          }
          const row = result[0].values[0];
          const columns = result[0].columns;
          const obj = {};
          for (let i = 0; i < columns.length; i++) {
            obj[columns[i]] = row[i];
          }
          return obj;
        },
        all(...params) {
          const result = db.exec(sql, params);
          if (result.length === 0) {
            return [];
          }
          const columns = result[0].columns;
          return result[0].values.map(row => {
            const obj = {};
            for (let i = 0; i < columns.length; i++) {
              obj[columns[i]] = row[i];
            }
            return obj;
          });
        }
      };
    },
    
    exec(sql) {
      db.run(sql);
      if (!this._inTransaction) {
        saveDatabase(db, dbPath);
      }
    },
    
    pragma() {
    },
    
    _inTransaction: false,
    
    transaction(fn) {
      db.run('BEGIN TRANSACTION');
      this._inTransaction = true;
      try {
        const result = fn();
        db.run('COMMIT');
        this._inTransaction = false;
        saveDatabase(db, dbPath);
        return result;
      } catch (e) {
        db.run('ROLLBACK');
        this._inTransaction = false;
        throw e;
      }
    },
    
    close() {
      saveDatabase(db, dbPath);
      db.close();
      dbInstance = null;
    }
  };
  
  return dbInstance;
}

function saveDatabase(db, dbPath) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

async function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

async function initDatabase(dbPath = DEFAULT_DB_PATH) {
  const db = await getDb(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS booths (
      id TEXT PRIMARY KEY,
      booth_number TEXT NOT NULL,
      zone TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vendor_booth_assignments (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      booth_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commission_rates (
      id TEXT PRIMARY KEY,
      booth_id TEXT,
      vendor_id TEXT,
      rate_type TEXT NOT NULL,
      flat_rate REAL,
      tier_config TEXT,
      effective_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_records (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      booth_id TEXT NOT NULL,
      sale_date TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_count INTEGER DEFAULT 1,
      source_file TEXT,
      source_file_hash TEXT,
      source_row_number INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      amount REAL NOT NULL,
      deposit_date TEXT NOT NULL,
      is_returned INTEGER DEFAULT 0,
      returned_date TEXT,
      note TEXT,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS electricity_fees (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      booth_id TEXT,
      amount REAL NOT NULL,
      fee_date TEXT NOT NULL,
      kwh REAL,
      note TEXT,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      booth_id TEXT,
      amount REAL NOT NULL,
      refund_date TEXT NOT NULL,
      related_sale_id TEXT,
      reason TEXT,
      note TEXT,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT,
      settlement_id TEXT,
      note TEXT,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      settlement_date TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT DEFAULT '${SETTLEMENT_STATUS.DRAFT}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settlement_items (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      vendor_id TEXT NOT NULL,
      booth_id TEXT,
      total_sales REAL DEFAULT 0,
      total_refunds REAL DEFAULT 0,
      net_sales REAL DEFAULT 0,
      commission_amount REAL DEFAULT 0,
      deposit_amount REAL DEFAULT 0,
      electricity_fee REAL DEFAULT 0,
      previous_payments REAL DEFAULT 0,
      amount_due REAL DEFAULT 0,
      adjustment_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settlement_adjustments (
      id TEXT PRIMARY KEY,
      settlement_item_id TEXT NOT NULL,
      adjustment_type TEXT,
      amount REAL DEFAULT 0,
      reason TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      data_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      records_count INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS validation_logs (
      id TEXT PRIMARY KEY,
      validation_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      message TEXT,
      severity TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS historical_refunds (
      id TEXT PRIMARY KEY,
      refund_id TEXT NOT NULL,
      original_settlement_id TEXT,
      new_settlement_id TEXT,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  return db;
}

function initConfig(configPath = DEFAULT_CONFIG_PATH, options = {}) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const defaultConfig = {
    marketName: options.marketName || '手作市集',
    defaultCommissionRate: options.defaultCommissionRate || 0.1,
    currency: options.currency || 'CNY',
    settlementPeriodDays: options.settlementPeriodDays || 7,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  return defaultConfig;
}

function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
}

module.exports = {
  getDb,
  closeDb,
  initDatabase,
  initConfig,
  loadConfig
};
