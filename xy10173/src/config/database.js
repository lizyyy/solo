const initSqlJs = require('sql.js');
const path = require('path');
const os = require('os');
const fs = require('fs');

let _db = null;
let _dbPath = null;
let _initPromise = null;
let _SQL = null;

function _resolveDbPath() {
  if (process.env.DB_PATH) {
    const dir = path.dirname(process.env.DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return process.env.DB_PATH;
  }

  const tmpDir = path.join(os.tmpdir(), 'points-freeze-api');
  if (!fs.existsSync(tmpDir)) {
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      return path.join(tmpDir, 'app.db');
    } catch (e) {}
  } else {
    return path.join(tmpDir, 'app.db');
  }

  const projectDataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(projectDataDir)) {
    try {
      fs.mkdirSync(projectDataDir, { recursive: true });
    } catch (e) {}
  }
  return path.join(projectDataDir, 'app.db');
}

function wrapDb(db, dbPath, SQL) {
  db._saveToDisk = function() {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  };

  db._dbPath = dbPath;

  db.run = function(sql, params = []) {
    const paramsArray = (Array.isArray(params) ? params : [params]).map(p => p === undefined ? null : p);
    const stmt = db.prepare(sql);
    stmt.bind(paramsArray);
    stmt.step();
    stmt.free();
    db._saveToDisk();
    const result = db.exec('SELECT last_insert_rowid() as id');
    return { 
      lastInsertRowid: result && result.length > 0 ? result[0].values[0][0] : 0 
    };
  };

  db.prepare = function(sql) {
    const originalStmt = SQL.Database.prototype.prepare.call(db, sql);

    const stmt = {
      _original: originalStmt,
      _db: db,

      run: function(...args) {
        const params = (args.length === 1 && Array.isArray(args[0]) ? args[0] : args).map(p => p === undefined ? null : p);
        originalStmt.bind(params);
        originalStmt.step();
        originalStmt.reset();
        db._saveToDisk();
        const result = db.exec('SELECT last_insert_rowid() as id');
        return { 
          lastInsertRowid: result && result.length > 0 ? result[0].values[0][0] : 0 
        };
      },

      get: function(...args) {
        const params = (args.length === 1 && Array.isArray(args[0]) ? args[0] : args).map(p => p === undefined ? null : p);
        originalStmt.bind(params);
        if (originalStmt.step()) {
          const values = originalStmt.getAsObject();
          originalStmt.reset();
          return values;
        }
        originalStmt.reset();
        return undefined;
      },

      all: function(...args) {
        const params = (args.length === 1 && Array.isArray(args[0]) ? args[0] : args).map(p => p === undefined ? null : p);
        originalStmt.bind(params);
        const results = [];
        while (originalStmt.step()) {
          results.push(originalStmt.getAsObject());
        }
        originalStmt.reset();
        return results;
      },

      free: function() {
        return originalStmt.free();
      }
    };

    return stmt;
  };

  db.pragma = function(pragma) {
    return [];
  };

  db.exec = function(sql) {
    return SQL.Database.prototype.exec.call(db, sql);
  };

  return db;
}

function resetDatabase() {
  if (_db) {
    try { _db.close(); } catch (e) {}
    _db = null;
  }
  _dbPath = null;
  _initPromise = null;
}

async function initDatabase() {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs();
    _SQL = SQL;
    const DB_PATH = _resolveDbPath();
    _dbPath = DB_PATH;

    let db;
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    _db = wrapDb(db, DB_PATH, SQL);
    return _db;
  })();

  return _initPromise;
}

function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

function getDbPath() {
  return _dbPath;
}

module.exports = {
  initDatabase,
  getDb,
  getDbPath,
  resetDatabase,
  DB_PATH: _dbPath
};
