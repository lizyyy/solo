const initSqlJs = require('sql.js');
const fs = require('fs-extra');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '..', 'data', 'db');
const DB_PATH = path.join(DB_DIR, 'health.db');

let db = null;
let SQL = null;

const TABLE_SCHEMAS = {
  health_records: `
    CREATE TABLE IF NOT EXISTS health_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source_name TEXT,
      source_version TEXT,
      device TEXT,
      unit TEXT,
      value REAL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      creation_date TEXT,
      metadata TEXT,
      date TEXT NOT NULL,
      hour INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_health_records_type ON health_records(type);
    CREATE INDEX IF NOT EXISTS idx_health_records_date ON health_records(date);
    CREATE INDEX IF NOT EXISTS idx_health_records_type_date ON health_records(type, date);
  `,
  daily_summaries: `
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      steps_total REAL DEFAULT 0,
      steps_avg REAL DEFAULT 0,
      steps_max REAL DEFAULT 0,
      sleep_total REAL DEFAULT 0,
      sleep_deep REAL DEFAULT 0,
      sleep_light REAL DEFAULT 0,
      sleep_rem REAL DEFAULT 0,
      sleep_bedtime TEXT,
      sleep_wake_time TEXT,
      resting_heart_rate_avg REAL DEFAULT 0,
      resting_heart_rate_min REAL DEFAULT 0,
      resting_heart_rate_max REAL DEFAULT 0,
      heart_rate_avg REAL DEFAULT 0,
      heart_rate_min REAL DEFAULT 0,
      heart_rate_max REAL DEFAULT 0,
      heart_rate_variability_avg REAL DEFAULT 0,
      heart_rate_variability_sdnn REAL DEFAULT 0,
      active_energy REAL DEFAULT 0,
      basal_energy REAL DEFAULT 0,
      workout_count INTEGER DEFAULT 0,
      workout_duration REAL DEFAULT 0,
      workout_distance REAL DEFAULT 0,
      workout_energy REAL DEFAULT 0,
      has_data INTEGER DEFAULT 0,
      data_missing TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);
  `,
  workouts: `
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      workout_activity_type TEXT NOT NULL,
      duration REAL DEFAULT 0,
      duration_unit TEXT DEFAULT 'min',
      total_distance REAL DEFAULT 0,
      total_distance_unit TEXT DEFAULT 'km',
      total_energy_burned REAL DEFAULT 0,
      total_energy_burned_unit TEXT DEFAULT 'kcal',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      creation_date TEXT,
      source_name TEXT,
      device TEXT,
      metadata TEXT,
      date TEXT NOT NULL,
      gpx_file TEXT,
      has_gpx INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
    CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts(workout_activity_type);
    CREATE INDEX IF NOT EXISTS idx_workouts_type_date ON workouts(workout_activity_type, date);
  `,
  workout_routes: `
    CREATE TABLE IF NOT EXISTS workout_routes (
      id TEXT PRIMARY KEY,
      workout_id TEXT NOT NULL,
      point_index INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      timestamp TEXT,
      heart_rate REAL,
      speed REAL,
      cadence REAL,
      distance REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workout_id) REFERENCES workouts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_workout_routes_workout ON workout_routes(workout_id);
    CREATE INDEX IF NOT EXISTS idx_workout_routes_workout_index ON workout_routes(workout_id, point_index);
  `,
  daily_notes: `
    CREATE TABLE IF NOT EXISTS daily_notes (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      tags TEXT DEFAULT '',
      note TEXT DEFAULT '',
      source TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON daily_notes(date);
  `,
  thresholds: `
    CREATE TABLE IF NOT EXISTS thresholds (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value REAL NOT NULL,
      label TEXT,
      description TEXT,
      unit TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, key)
    );
    CREATE INDEX IF NOT EXISTS idx_thresholds_category ON thresholds(category);
  `,
  anomalies: `
    CREATE TABLE IF NOT EXISTS anomalies (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      description TEXT,
      related_metrics TEXT,
      related_dates TEXT,
      threshold_value REAL,
      actual_value REAL,
      is_dismissed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_anomalies_date ON anomalies(date);
    CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type);
    CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
  `,
  import_logs: `
    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      records_imported INTEGER DEFAULT 0,
      records_skipped INTEGER DEFAULT 0,
      errors TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_import_logs_status ON import_logs(status);
    CREATE INDEX IF NOT EXISTS idx_import_logs_started ON import_logs(started_at);
  `
};

async function initDatabase() {
  if (db) return db;
  
  SQL = await initSqlJs();
  
  await fs.ensureDir(DB_DIR);
  
  if (await fs.pathExists(DB_PATH)) {
    const buffer = await fs.readFile(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('📦 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('📦 Created new database');
  }
  
  for (const [table, schema] of Object.entries(TABLE_SCHEMAS)) {
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      try {
        db.run(stmt.trim());
      } catch (err) {
        console.warn(`Warning creating table ${table}:`, err.message);
      }
    }
  }
  
  await initDefaultThresholds();
  
  await saveDatabase();
  
  return db;
}

async function initDefaultThresholds() {
  const defaultThresholds = [
    { category: 'sleep', key: 'target_hours', value: 7.5, label: '目标睡眠时长', description: '每日推荐睡眠时长', unit: '小时' },
    { category: 'sleep', key: 'min_acceptable', value: 6, label: '最低可接受睡眠', description: '低于此值视为睡眠不足', unit: '小时' },
    { category: 'sleep', key: 'consecutive_bad_days', value: 3, label: '连续睡眠不足天数', description: '连续多少天睡眠不足触发预警', unit: '天' },
    
    { category: 'heart_rate', key: 'resting_high', value: 80, label: '静息心率偏高阈值', description: '静息心率高于此值视为偏高', unit: 'bpm' },
    { category: 'heart_rate', key: 'resting_low', value: 40, label: '静息心率偏低阈值', description: '静息心率低于此值视为偏低', unit: 'bpm' },
    { category: 'heart_rate', key: 'variability_low', value: 20, label: 'HRV 偏低阈值', description: '心率变异性低于此值视为偏低', unit: 'ms' },
    
    { category: 'activity', key: 'steps_target', value: 10000, label: '每日步数目标', description: '每日推荐步数', unit: '步' },
    { category: 'activity', key: 'steps_low', value: 1000, label: '步数过低阈值', description: '低于此值可能数据缺失或活动极少', unit: '步' },
    { category: 'activity', key: 'workout_sudden_increase', value: 2.0, label: '运动量突增比例', description: '较前7天平均值增加多少倍视为突增', unit: '倍' },
    
    { category: 'recovery', key: 'sleep_debt_threshold', value: 5, label: '累计睡眠债阈值', description: '累计睡眠债超过此小时数预警', unit: '小时' },
  ];
  
  for (const threshold of defaultThresholds) {
    const existing = db.exec(`
      SELECT id FROM thresholds WHERE category = ? AND key = ?
    `, [threshold.category, threshold.key]);
    
    if (!existing.length || !existing[0].values.length) {
      db.run(`
        INSERT INTO thresholds (id, category, key, value, label, description, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        `threshold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        threshold.category,
        threshold.key,
        threshold.value,
        threshold.label,
        threshold.description,
        threshold.unit
      ]);
    }
  }
}

async function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  await fs.writeFile(DB_PATH, buffer);
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  saveDatabase().catch(console.error);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.getAsObject(params);
  stmt.free();
  return result || null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const results = stmt.getAsObject(params);
  const allResults = [];
  
  while (stmt.step()) {
    allResults.push(stmt.getAsObject());
  }
  
  stmt.free();
  return allResults;
}

function exec(sql) {
  return db.exec(sql);
}

module.exports = {
  initDatabase,
  saveDatabase,
  getDb,
  run,
  get,
  all,
  exec,
};
