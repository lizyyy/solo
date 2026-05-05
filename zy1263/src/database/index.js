const path = require('path');
const fs = require('fs-extra');

let dbInstance = null;
let dbPath = null;
let SQL = null;

async function initSqlJs() {
  if (!SQL) {
    SQL = await require('sql.js')();
  }
  return SQL;
}

function createPreparedStatement(db, sql) {
  return {
    run: function(...params) {
      let paramArray;
      if (params.length === 0) {
        paramArray = [];
      } else if (params.length === 1 && Array.isArray(params[0])) {
        paramArray = params[0];
      } else if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
        paramArray = Object.values(params[0]);
      } else {
        paramArray = params;
      }
      
      db.run(sql, paramArray);
      saveDb();
      
      const stmt = db.prepare("SELECT last_insert_rowid() as id");
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      return { lastInsertRowid: result.id || 0, changes: db.getRowsModified() };
    },
    
    all: function(params = []) {
      const stmt = db.prepare(sql);
      const results = [];
      
      if (stmt.bind(params)) {
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
      }
      stmt.free();
      return results;
    },
    
    get: function(params = []) {
      const results = this.all(params);
      return results.length > 0 ? results[0] : undefined;
    },
    
    pluck: function() {
      const originalAll = this.all.bind(this);
      return {
        all: function(params = []) {
          const results = originalAll(params);
          if (results.length === 0) return [];
          const keys = Object.keys(results[0]);
          return results.map(r => r[keys[0]]);
        },
        get: function(params = []) {
          const results = originalAll(params);
          if (results.length === 0) return undefined;
          const keys = Object.keys(results[0]);
          return results[0][keys[0]];
        }
      };
    }
  };
}

let inTransaction = false;

function wrapDbInstance(db) {
  const wrapper = {
    _raw: db,
    
    prepare: function(sql) {
      return {
        run: function(...params) {
          let paramArray;
          if (params.length === 0) {
            paramArray = [];
          } else if (params.length === 1 && Array.isArray(params[0])) {
            paramArray = params[0];
          } else if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            paramArray = Object.values(params[0]);
          } else {
            paramArray = params;
          }
          
          db.run(sql, paramArray);
          if (!inTransaction) {
            saveDb();
          }
          
          const stmt = db.prepare("SELECT last_insert_rowid() as id");
          stmt.step();
          const result = stmt.getAsObject();
          stmt.free();
          return { lastInsertRowid: result.id || 0, changes: db.getRowsModified() };
        },
        
        all: function(params = []) {
          const stmt = db.prepare(sql);
          const results = [];
          
          if (stmt.bind(params)) {
            while (stmt.step()) {
              results.push(stmt.getAsObject());
            }
          }
          stmt.free();
          return results;
        },
        
        get: function(params = []) {
          const results = this.all(params);
          return results.length > 0 ? results[0] : undefined;
        },
        
        pluck: function() {
          const originalAll = this.all.bind(this);
          return {
            all: function(params = []) {
              const results = originalAll(params);
              if (results.length === 0) return [];
              const keys = Object.keys(results[0]);
              return results.map(r => r[keys[0]]);
            },
            get: function(params = []) {
              const results = originalAll(params);
              if (results.length === 0) return undefined;
              const keys = Object.keys(results[0]);
              return results[0][keys[0]];
            }
          };
        }
      };
    },
    
    run: function(sql, params = []) {
      db.run(sql, params);
      if (!inTransaction) {
        saveDb();
      }
      
      const stmt = db.prepare("SELECT last_insert_rowid() as id");
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      return { lastInsertRowid: result.id || 0, changes: db.getRowsModified() };
    },
    
    exec: function(sql) {
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          db.run(stmt);
        }
      }
      if (!inTransaction) {
        saveDb();
      }
    },
    
    transaction: function(fn) {
      return function(...args) {
        db.run('BEGIN TRANSACTION');
        inTransaction = true;
        try {
          const result = fn(...args);
          db.run('COMMIT');
          inTransaction = false;
          saveDb();
          return result;
        } catch (e) {
          try {
            db.run('ROLLBACK');
          } catch (rollbackErr) {
          }
          inTransaction = false;
          throw e;
        }
      };
    }
  };
  
  return wrapper;
}

async function initDb(dbPathParam = './msa-db.sqlite') {
  const absolutePath = path.resolve(dbPathParam);
  const dir = path.dirname(absolutePath);
  fs.ensureDirSync(dir);
  
  dbPath = absolutePath;
  
  await initSqlJs();
  
  let rawDb;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }
  
  dbInstance = wrapDbInstance(rawDb);
  
  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    throw new Error('数据库未初始化，请先调用 initDb()');
  }
  return dbInstance;
}

function saveDb() {
  if (dbInstance && dbPath) {
    const data = dbInstance._raw.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function closeDb() {
  if (dbInstance) {
    saveDb();
    dbInstance._raw.close();
    dbInstance = null;
  }
}

function prepare(sql) {
  const db = getDb();
  return db.prepare(sql);
}

function run(sql, params = []) {
  const db = getDb();
  return db.run(sql, params);
}

function exec(sql, params = []) {
  const db = getDb();
  return db.exec(sql, params);
}

function transaction(fn) {
  const db = getDb();
  return db.transaction(fn);
}

function createTables() {
  const db = getDb();
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      domain TEXT,
      owner_team TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS database_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      schema_name TEXT,
      owner_service TEXT,
      description TEXT,
      row_count INTEGER,
      size_mb REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_table_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      access_type TEXT NOT NULL,
      access_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(service_name, table_name, access_type)
    );

    CREATE TABLE IF NOT EXISTS domain_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_service TEXT,
      event_type TEXT,
      description TEXT,
      payload_schema TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS service_event_publish (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      event_name TEXT NOT NULL,
      publish_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(service_name, event_name)
    );

    CREATE TABLE IF NOT EXISTS service_event_subscribe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      event_name TEXT NOT NULL,
      subscribe_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(service_name, event_name)
    );

    CREATE TABLE IF NOT EXISTS call_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_service TEXT NOT NULL,
      target_service TEXT NOT NULL,
      call_type TEXT NOT NULL,
      endpoint_id INTEGER,
      call_count INTEGER DEFAULT 0,
      avg_latency_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_service, target_service, call_type, endpoint_id)
    );

    CREATE TABLE IF NOT EXISTS analysis_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_name TEXT NOT NULL,
      analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      affected_entities TEXT,
      recommendation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS table_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      service_name TEXT NOT NULL,
      is_owner INTEGER DEFAULT 0,
      confidence REAL DEFAULT 0,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(table_name, service_name)
    );
  `;
  
  exec(createTableSQL);
  
  return dbInstance;
}

module.exports = {
  initDb,
  getDb,
  closeDb,
  createTables,
  saveDb,
  prepare,
  run,
  exec,
  transaction
};
