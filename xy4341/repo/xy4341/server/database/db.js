const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'fire_drill.db');
const DB_DIR = path.dirname(DB_PATH);

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Database loaded from', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('New database created');
    initializeTables();
    saveDatabase();
  }
  
  return db;
}

function initializeTables() {
  if (!db) throw new Error('Database not initialized');
  
  // Floors table
  db.run(`
    CREATE TABLE IF NOT EXISTS floors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      floor_number INTEGER NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      layout TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Exits table
  db.run(`
    CREATE TABLE IF NOT EXISTS exits (
      id TEXT PRIMARY KEY,
      floor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'normal',
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      status TEXT DEFAULT 'available',
      capacity INTEGER DEFAULT 1,
      capacity_per_minute INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `);
  
  // Persons table (population distribution)
  db.run(`
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      floor_id TEXT NOT NULL,
      name TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      status TEXT DEFAULT 'idle',
      speed REAL DEFAULT 1.0,
      mobility TEXT DEFAULT 'normal',
      nearest_exit_id TEXT,
      evacuation_time REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (floor_id) REFERENCES floors(id),
      FOREIGN KEY (nearest_exit_id) REFERENCES exits(id)
    )
  `);
  
  // Drill sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS drill_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'created',
      start_time DATETIME,
      end_time DATETIME,
      current_time_step INTEGER DEFAULT 0,
      is_paused INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Fire points table
  db.run(`
    CREATE TABLE IF NOT EXISTS fire_points (
      id TEXT PRIMARY KEY,
      drill_session_id TEXT NOT NULL,
      floor_id TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      intensity REAL DEFAULT 1.0,
      radius REAL DEFAULT 5.0,
      time_step INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drill_session_id) REFERENCES drill_sessions(id),
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `);
  
  // Drill events table (for timeline)
  db.run(`
    CREATE TABLE IF NOT EXISTS drill_events (
      id TEXT PRIMARY KEY,
      drill_session_id TEXT NOT NULL,
      time_step INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drill_session_id) REFERENCES drill_sessions(id)
    )
  `);
  
  // Risk assessments table
  db.run(`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id TEXT PRIMARY KEY,
      drill_session_id TEXT NOT NULL,
      time_step INTEGER NOT NULL,
      floor_id TEXT,
      overall_score REAL NOT NULL,
      congestion_score REAL,
      fire_spread_score REAL,
      exit_availability_score REAL,
      evacuation_progress_score REAL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drill_session_id) REFERENCES drill_sessions(id),
      FOREIGN KEY (floor_id) REFERENCES floors(id)
    )
  `);
  
  // Broadcast schedule table
  db.run(`
    CREATE TABLE IF NOT EXISTS broadcast_schedule (
      id TEXT PRIMARY KEY,
      drill_session_id TEXT NOT NULL,
      time_step INTEGER NOT NULL,
      message TEXT NOT NULL,
      is_broadcasted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drill_session_id) REFERENCES drill_sessions(id)
    )
  `);
  
  // Simulation snapshots (for persistence)
  db.run(`
    CREATE TABLE IF NOT EXISTS simulation_snapshots (
      id TEXT PRIMARY KEY,
      drill_session_id TEXT NOT NULL,
      time_step INTEGER NOT NULL,
      snapshot_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (drill_session_id) REFERENCES drill_sessions(id)
    )
  `);
  
  console.log('All tables initialized');
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDatabase() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function query(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const stmt = db.prepare(sql);
    const results = [];
    
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    db.run(sql, params);
    saveDatabase();
    return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] };
  } catch (error) {
    console.error('Run error:', error);
    throw error;
  }
}

function transaction(callback) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    db.run('BEGIN TRANSACTION');
    callback();
    db.run('COMMIT');
    saveDatabase();
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  query,
  run,
  transaction
};
