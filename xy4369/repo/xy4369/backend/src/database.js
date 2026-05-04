const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'ropes.db');
const DB_DIR = path.dirname(DB_PATH);

let db = null;

async function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS ropes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rope_number TEXT UNIQUE NOT NULL,
      brand TEXT,
      model TEXT,
      purchase_date TEXT,
      length_m REAL,
      diameter_mm REAL,
      wear_level INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rope_id INTEGER NOT NULL,
      usage_date TEXT NOT NULL,
      uses_count INTEGER DEFAULT 0,
      fall_energy_kj REAL DEFAULT 0,
      fall_factor REAL,
      climber_weight_kg REAL,
      fall_distance_m REAL,
      wear_level INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (rope_id) REFERENCES ropes(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_usage_records_rope_id ON usage_records(rope_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_usage_records_date ON usage_records(usage_date)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manufacturer_thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      max_total_energy_kj REAL NOT NULL,
      max_service_days INTEGER NOT NULL,
      max_wear_level INTEGER NOT NULL,
      max_daily_uses INTEGER NOT NULL,
      max_daily_energy_kj REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(brand, model)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rope_id INTEGER NOT NULL,
      assessment_date TEXT NOT NULL,
      total_energy_kj REAL DEFAULT 0,
      service_days INTEGER DEFAULT 0,
      current_wear_level INTEGER DEFAULT 0,
      max_daily_uses INTEGER DEFAULT 0,
      max_daily_energy_kj REAL DEFAULT 0,
      energy_risk_level TEXT DEFAULT 'normal',
      days_risk_level TEXT DEFAULT 'normal',
      wear_risk_level TEXT DEFAULT 'normal',
      daily_overload_risk_level TEXT DEFAULT 'normal',
      overall_risk_level TEXT DEFAULT 'normal',
      risk_factors TEXT,
      FOREIGN KEY (rope_id) REFERENCES ropes(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risk_assessments_rope_id ON risk_assessments(rope_id)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS review_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      risk_assessment_id INTEGER NOT NULL,
      original_risk_level TEXT NOT NULL,
      new_risk_level TEXT NOT NULL,
      decision_type TEXT NOT NULL,
      reviewer_name TEXT,
      review_notes TEXT,
      is_scrapped INTEGER DEFAULT 0,
      review_date TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (risk_assessment_id) REFERENCES risk_assessments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scrap_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rope_id INTEGER NOT NULL,
      decision_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      risk_factors_at_scrap TEXT,
      reviewer_name TEXT,
      notes TEXT,
      FOREIGN KEY (rope_id) REFERENCES ropes(id)
    )
  `);

  saveDatabase();
  console.log('数据库初始化完成');
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDatabase() {
  return db;
}

function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  closeDatabase
};
