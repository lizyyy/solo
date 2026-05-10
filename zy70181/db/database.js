const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;
const dbPath = path.join(__dirname, '..', 'receivable.db');

async function initDatabase() {
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {
      console.warn('保存数据库失败:', e.message);
    }
  }
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return db;
}

function exec(sql) {
  const db = getDb();
  const result = db.exec(sql);
  saveDatabase();
  return result;
}

function run(sql, ...params) {
  const db = getDb();
  const cleanParams = params.map(p => p === undefined ? null : p);
  
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams);
  stmt.step();
  stmt.free();
  
  const lastIdStmt = db.prepare('SELECT last_insert_rowid() as id');
  lastIdStmt.bind();
  lastIdStmt.step();
  const lastId = lastIdStmt.getAsObject().id;
  lastIdStmt.free();
  
  const changesStmt = db.prepare('SELECT changes() as changes');
  changesStmt.bind();
  changesStmt.step();
  const changes = changesStmt.getAsObject().changes;
  changesStmt.free();
  
  saveDatabase();
  
  return { lastInsertRowid: lastId, changes };
}

function get(sql, ...params) {
  const db = getDb();
  const cleanParams = params.map(p => p === undefined ? null : p);
  
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams);
  
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return undefined;
}

function all(sql, ...params) {
  const db = getDb();
  const cleanParams = params.map(p => p === undefined ? null : p);
  
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function transaction(fn) {
  exec('BEGIN TRANSACTION');
  try {
    const result = fn();
    exec('COMMIT');
    return result;
  } catch (error) {
    exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  exec,
  run,
  get,
  all,
  transaction
};
