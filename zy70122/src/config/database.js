const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;

async function initDatabase() {
  if (db) return db;
  
  SQL = await initSqlJs();
  
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const dbPath = path.join(__dirname, '../../data/meal-settlement.db');
  
  let fileBuffer = null;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(fileBuffer);
  
  return db;
}

function saveDatabase() {
  if (db) {
    const dbPath = path.join(__dirname, '../../data/meal-settlement.db');
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function normalizeParams(params) {
  return params.map(p => p === undefined ? null : p);
}

class Statement {
  constructor(sql) {
    this.sql = sql;
  }
  
  run(...params) {
    const normalized = normalizeParams(params);
    const stmt = db.prepare(this.sql);
    stmt.bind(normalized);
    stmt.step();
    stmt.free();
    saveDatabase();
    return { changes: db.getRowsModified() };
  }
  
  get(...params) {
    const normalized = normalizeParams(params);
    const stmt = db.prepare(this.sql);
    stmt.bind(normalized);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }
  
  all(...params) {
    const normalized = normalizeParams(params);
    const stmt = db.prepare(this.sql);
    stmt.bind(normalized);
    const results = [];
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

module.exports = {
  initDatabase,
  saveDatabase,
  exec: (sql) => {
    if (!db) throw new Error('Database not initialized');
    db.run(sql);
    saveDatabase();
  },
  prepare: (sql) => new Statement(sql),
  pragma: () => {},
  transaction: (fn) => {
    fn();
    saveDatabase();
  }
};
