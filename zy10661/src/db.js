const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db = null;
const dbPath = path.join(__dirname, '../data/claim-notice.db');

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    createTables();
  }
  
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      policy_no TEXT,
      incident_type TEXT,
      incident_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_items (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      material_code TEXT NOT NULL,
      material_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notice_records (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      flow_type TEXT NOT NULL DEFAULT 'NORMAL',
      operator_id TEXT,
      operator_name TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history_logs (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      notice_id TEXT,
      material_id TEXT,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      operator_id TEXT,
      operator_name TEXT,
      remark TEXT,
      flow_type TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conflict_records (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      notice_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      detected_by TEXT,
      description TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT,
      resolution TEXT,
      status TEXT NOT NULL DEFAULT 'DETECTED'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS import_bad_rows (
      id TEXT PRIMARY KEY,
      import_batch_id TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      row_data TEXT NOT NULL,
      error_message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

function getDb() {
  if (!db) throw new Error('数据库未初始化');
  return db;
}

function generateId() {
  return uuidv4();
}

function now() {
  return new Date().toISOString();
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.getAsObject();
  stmt.free();
  return Object.keys(result).length > 0 ? result : null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all,
  generateId,
  now,
  saveDatabase
};
