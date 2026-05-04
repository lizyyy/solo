const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/road_inspection.db');
const DB_DIR = path.dirname(DB_PATH);

let db;

async function initDatabase() {
  // 确保数据目录存在
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    // 加载现有数据库
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    // 创建新数据库
    db = new SQL.Database();
    createTables();
  }
  
  console.log('数据库初始化完成');
  return db;
}

function createTables() {
  // 勘察批次表
  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 路线表
  db.run(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      gpx_data TEXT,
      total_distance REAL,
      total_duration REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id)
    )
  `);

  // 路点表
  db.run(`
    CREATE TABLE IF NOT EXISTS waypoints (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      speed REAL,
      timestamp DATETIME,
      sequence INTEGER NOT NULL,
      distance_from_start REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )
  `);

  // 路段表（用于聚合分析）
  db.run(`
    CREATE TABLE IF NOT EXISTS road_segments (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      start_latitude REAL NOT NULL,
      start_longitude REAL NOT NULL,
      end_latitude REAL NOT NULL,
      end_longitude REAL NOT NULL,
      segment_length REAL,
      start_waypoint_id TEXT,
      end_waypoint_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )
  `);

  // 路况报告表
  db.run(`
    CREATE TABLE IF NOT EXISTS road_conditions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      route_id TEXT,
      segment_id TEXT,
      waypoint_id TEXT,
      condition_type TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      description TEXT,
      latitude REAL,
      longitude REAL,
      speed REAL,
      speed_change REAL,
      timestamp DATETIME,
      photo_ids TEXT,
      is_overruled INTEGER DEFAULT 0,
      overrule_reason TEXT,
      overruled_by TEXT,
      overruled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (segment_id) REFERENCES road_segments(id),
      FOREIGN KEY (waypoint_id) REFERENCES waypoints(id)
    )
  `);

  // 照片表
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      condition_id TEXT,
      filename TEXT NOT NULL,
      original_path TEXT,
      storage_path TEXT,
      latitude REAL,
      longitude REAL,
      timestamp DATETIME,
      description TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
      FOREIGN KEY (condition_id) REFERENCES road_conditions(id)
    )
  `);

  // 风险聚合表
  db.run(`
    CREATE TABLE IF NOT EXISTS risk_aggregations (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      segment_id TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      risk_count INTEGER DEFAULT 0,
      max_severity TEXT,
      avg_speed REAL,
      min_speed REAL,
      speed_variance REAL,
      photo_count INTEGER DEFAULT 0,
      risk_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
      FOREIGN KEY (segment_id) REFERENCES road_segments(id)
    )
  `);

  // 导出记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS export_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      export_type TEXT NOT NULL,
      export_path TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id)
    )
  `);

  saveDatabase();
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

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase
};
