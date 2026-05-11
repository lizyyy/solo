const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

let db = null;
let SQL = null;

const saveDb = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const initDb = async () => {
  if (db) return db;

  SQL = await initSqlJs();

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initTables();
  return db;
};

const initTables = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      driver_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      car_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS terminals (
      terminal_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vouchers (
      voucher_id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      car_type TEXT NOT NULL,
      status TEXT NOT NULL,
      queue_position INTEGER,
      no_show_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS terminal_queues (
      queue_id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      car_type TEXT NOT NULL,
      voucher_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      entered_at INTEGER NOT NULL,
      exited_at INTEGER,
      exit_reason TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS no_show_records (
      record_id TEXT PRIMARY KEY,
      voucher_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      car_type TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      reason TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      request_type TEXT NOT NULL,
      response TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  const terminals = [
    { terminal_id: 'T1', name: 'T1 航站楼', code: 'T1' },
    { terminal_id: 'T2', name: 'T2 航站楼', code: 'T2' },
    { terminal_id: 'T3', name: 'T3 航站楼', code: 'T3' }
  ];

  for (const t of terminals) {
    const checkStmt = db.prepare('SELECT * FROM terminals WHERE terminal_id = ?');
    checkStmt.bind([t.terminal_id]);
    const exists = checkStmt.step();
    checkStmt.reset();
    if (!exists) {
      db.run(
        'INSERT INTO terminals (terminal_id, name, code, is_active) VALUES (?, ?, ?, 1)',
        [t.terminal_id, t.name, t.code]
      );
    }
  }
  saveDb();
};

const getDb = () => db;

const closeDb = () => {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
};

class Transaction {
  constructor() {
    this.pending = [];
  }

  run(sql, ...params) {
    this.pending.push({ sql, params });
    db.run(sql, ...params);
  }

  commit() {
    saveDb();
  }

  rollback() {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const { sql, params } = this.pending[i];
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const table = sql.split(' ')[2];
        const placeholder = params.map((_, i) => `$${i + 1}`).join(' AND ');
        const colNames = sql.match(/\(([^)]+)\)/)[1].split(',').map(c => c.trim());
        const where = colNames.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
        db.run(`DELETE FROM ${table} WHERE ${where}`, ...params);
      }
    }
    saveDb();
  }
}

module.exports = { getDb, initDb, closeDb, saveDb, Transaction };
