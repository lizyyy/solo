const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'crane_schedule.db');

let db;
let SQL;

async function initDb() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  createTables();
  createIndexes();
  saveDb();
  
  console.log('数据库初始化完成');
  return db;
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS cranes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      max_wind_speed REAL NOT NULL DEFAULT 20.0,
      max_load REAL NOT NULL DEFAULT 10.0,
      building_range TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 10,
      average_weight REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lift_applications (
      id TEXT PRIMARY KEY,
      application_no TEXT NOT NULL UNIQUE,
      crane_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      building_no TEXT NOT NULL,
      floor INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      estimated_weight REAL NOT NULL DEFAULT 0.0,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      priority INTEGER NOT NULL DEFAULT 10,
      scheduled_time TEXT,
      executed_time TEXT,
      completed_time TEXT,
      source_record_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lift_records (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      crane_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      building_no TEXT NOT NULL,
      floor INTEGER NOT NULL,
      actual_weight REAL NOT NULL,
      wind_speed REAL NOT NULL,
      operator TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      schedule_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id TEXT PRIMARY KEY,
      measured_at TEXT NOT NULL,
      wind_speed REAL NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS application_logs (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      performed_by TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `);
}

function createIndexes() {
  db.run(`CREATE INDEX IF NOT EXISTS idx_applications_status ON lift_applications(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_applications_crane ON lift_applications(crane_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_applications_building ON lift_applications(building_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_records_crane ON lift_records(crane_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_records_status ON lift_records(status)`);
  saveDb();
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

function prepare(query) {
  return {
    run(...params) {
      const stmt = db.prepare(query);
      stmt.run(params);
      stmt.free();
      saveDb();
      return { changes: db.getRowsModified() };
    },
    get(...params) {
      const stmt = db.prepare(query);
      stmt.bind(params);
      if (!stmt.step()) {
        stmt.free();
        return undefined;
      }
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    },
    all(...params) {
      const stmt = db.prepare(query);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDb();
}

module.exports = { initDb, getDb, prepare, exec };
