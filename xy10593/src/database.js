const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'sales.db');

const cleanParams = (params) => {
  return params.map(p => p === undefined ? null : p);
};

const initDb = async () => {
  if (db) return db;
  
  SQL = await initSqlJs();
  
  fs.mkdirSync(dataDir, { recursive: true });
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
};

const saveDb = () => {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const exec = (sql, params = []) => {
  if (!db) throw new Error('Database not initialized');
  
  const cleanP = cleanParams(params);
  const stmt = db.prepare(sql);
  if (cleanP.length > 0) {
    stmt.bind(cleanP);
  }
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  saveDb();
  
  return results;
};

const run = (sql, params = []) => {
  if (!db) throw new Error('Database not initialized');
  
  const cleanP = cleanParams(params);
  db.run(sql, cleanP);
  saveDb();
  
  return {
    lastInsertRowid: db.getRowsModified() > 0 ? db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] : null,
    changes: db.getRowsModified()
  };
};

const prepare = (sql) => {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare(sql);
  
  return {
    run: (params = []) => {
      const cleanP = cleanParams(params);
      if (cleanP.length > 0) {
        stmt.bind(cleanP);
      }
      stmt.step();
      stmt.reset();
      saveDb();
      return { changes: db.getRowsModified() };
    },
    get: (params = []) => {
      const cleanP = cleanParams(params);
      if (cleanP.length > 0) {
        stmt.bind(cleanP);
      }
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.reset();
        return row;
      }
      stmt.reset();
      return undefined;
    },
    all: (params = []) => {
      const cleanP = cleanParams(params);
      if (cleanP.length > 0) {
        stmt.bind(cleanP);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.reset();
      return results;
    },
    free: () => {
      stmt.free();
    }
  };
};

const close = () => {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
};

module.exports = {
  initDb,
  saveDb,
  exec,
  run,
  prepare,
  close
};
