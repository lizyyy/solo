const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'contracts.db');

let db = null;
let SQL = null;

const saveDb = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const initDb = async () => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_no TEXT NOT NULL UNIQUE,
      current_version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contract_versions (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      parties TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_area REAL NOT NULL,
      total_rent REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contract_id, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS land_plots (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      plot_no TEXT NOT NULL,
      area REAL NOT NULL,
      location TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rent_plans (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      paid_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS renewal_requests (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      requested_end_date TEXT NOT NULL,
      new_rent REAL,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS breach_reminders (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS performance_records (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      rent_paid REAL DEFAULT 0,
      rent_due REAL DEFAULT 0,
      area_confirmed REAL DEFAULT 0,
      status TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resource_locks (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      lock_token TEXT NOT NULL,
      locked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (resource_type, resource_id)
    )
  `);

  saveDb();
};

const getDb = () => ({
  run: (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    saveDb();
  },
  
  get: (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    }
    stmt.free();
    return undefined;
  },
  
  all: (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },
  
  prepare: (sql) => {
    return {
      run: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        try {
          stmt.step();
        } catch (e) {
          // INSERT 语句可能不返回行，这是正常的
        }
        const changes = db.getRowsModified();
        stmt.free();
        saveDb();
        return { changes };
      },
      
      get: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      
      all: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  },
  
  transaction: (fn) => {
    db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      db.run('COMMIT');
      saveDb();
      return result;
    } catch (e) {
      try {
        db.run('ROLLBACK');
      } catch (rollbackError) {
        // 忽略回滚错误，可能是因为内部语句已经失败导致事务被隐式回滚
      }
      throw e;
    }
  },
  
  exec: (sql) => {
    db.run(sql);
    saveDb();
  }
});

module.exports = { initDb, getDb };
