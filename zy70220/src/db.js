const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbPath = path.join(__dirname, '..', 'water-management.db');

let db;

const initDB = async () => {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS water_tanks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_capacity REAL NOT NULL,
      current_level REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room_stays (
      id TEXT PRIMARY KEY,
      room_number TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      check_in_time TEXT NOT NULL,
      check_out_time TEXT,
      status TEXT NOT NULL,
      basic_water_allocated REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS water_usages (
      id TEXT PRIMARY KEY,
      stay_id TEXT,
      room_number TEXT,
      usage_type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      is_manual_correction INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      reason TEXT,
      operator TEXT,
      created_at TEXT NOT NULL
    )
  `);

  const existingTank = db.exec('SELECT * FROM water_tanks WHERE id = ?', [config.DEFAULT_WATER_TANK_ID]);

  if (existingTank.length === 0 || existingTank[0].values.length === 0) {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO water_tanks (id, name, max_capacity, current_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        config.DEFAULT_WATER_TANK_ID,
        '主供水箱',
        config.WATER_TANK_MAX_CAPACITY,
        config.WATER_TANK_MAX_CAPACITY,
        now,
        now
      ]
    );
    saveDB();
  }

  return db;
};

const saveDB = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const toRow = (columns, values) => {
  if (!values) return undefined;
  const row = {};
  columns.forEach((col, i) => {
    row[col] = values[i];
  });
  return row;
};

const prepare = (sql) => {
  return {
    run: function(...params) {
      db.run(sql, params.flat());
      saveDB();
      return this;
    },
    get: function(...params) {
      const result = db.exec(sql, params.flat());
      if (result.length === 0 || result[0].values.length === 0) {
        return undefined;
      }
      return toRow(result[0].columns, result[0].values[0]);
    },
    all: function(...params) {
      const result = db.exec(sql, params.flat());
      if (result.length === 0) {
        return [];
      }
      const columns = result[0].columns;
      return result[0].values.map(values => toRow(columns, values));
    }
  };
};

const exec = (sql) => {
  db.run(sql);
  saveDB();
};

module.exports = {
  initDB,
  saveDB,
  prepare,
  exec,
  getDB: () => db
};
