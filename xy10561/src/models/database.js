const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'charity.db');

let dbInstance = null;
let SQL = null;

async function initDB() {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  return dbInstance;
}

function getDB() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return dbInstance;
}

function saveDB() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function cleanParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map(p => p === undefined ? null : p);
}

function run(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams(params));
  const result = stmt.run();
  stmt.free();
  saveDB();
  return result;
}

function get(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams(params));
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

function all(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(cleanParams(params));
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

module.exports = {
  initDB,
  getDB,
  saveDB,
  run,
  get,
  all
};
