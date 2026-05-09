const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'offboarding.db');

let db;

async function initDb() {
  const SQL = await initSqlJs();
  let filebuffer;
  try {
    filebuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(filebuffer);
  } catch (e) {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS offboarding_forms (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    department TEXT NOT NULL,
    last_day TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '待处理',
    creator TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS permission_inventories (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    system_name TEXT NOT NULL,
    permission_type TEXT NOT NULL,
    permission_desc TEXT,
    status TEXT NOT NULL DEFAULT '待回收',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (form_id) REFERENCES offboarding_forms(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reclamation_tasks (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    form_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '待执行',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    executed_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (inventory_id) REFERENCES permission_inventories(id),
    FOREIGN KEY (form_id) REFERENCES offboarding_forms(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exemptions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    applicant TEXT NOT NULL,
    approver TEXT,
    status TEXT NOT NULL DEFAULT '待审批',
    approved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (form_id) REFERENCES offboarding_forms(id),
    FOREIGN KEY (inventory_id) REFERENCES permission_inventories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    form_id TEXT,
    inventory_id TEXT,
    task_id TEXT,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_perm_form ON permission_inventories(form_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_form ON reclamation_tasks(form_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_form ON audit_logs(form_id)`);

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function exec(sql) {
  db.run(sql);
  saveDb();
}

module.exports = {
  initDb,
  all,
  get,
  run,
  exec
};
