const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'glaze.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 窑次表
  db.run(`CREATE TABLE IF NOT EXISTS kiln_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // 坯体表
  db.run(`CREATE TABLE IF NOT EXISTS bodies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // 釉料原料表
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    formula TEXT,
    oxides TEXT NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // 试片记录表
  db.run(`CREATE TABLE IF NOT EXISTS test_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kiln_run_id INTEGER NOT NULL,
    body_id INTEGER,
    sample_code TEXT,
    position TEXT,
    position_temp REAL,
    glaze_recipe TEXT NOT NULL,
    oxide_molars TEXT DEFAULT '{}',
    photo_path TEXT,
    notes TEXT,
    risks TEXT DEFAULT '[]',
    risk_override TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kiln_run_id) REFERENCES kiln_runs (id),
    FOREIGN KEY (body_id) REFERENCES bodies (id)
  )`);

  // 烧成曲线表
  db.run(`CREATE TABLE IF NOT EXISTS firing_curves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kiln_run_id INTEGER NOT NULL,
    name TEXT,
    curve_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kiln_run_id) REFERENCES kiln_runs (id)
  )`);
});

module.exports = db;
