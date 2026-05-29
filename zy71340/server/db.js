const Database = require('better-sqlite3');
const path = require('path');

function initDB() {
  const dbPath = path.join(__dirname, '../data/music-therapy.db');
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER,
      diagnosis TEXT,
      contact_info TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT,
      genre TEXT,
      duration INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS emotion_scales (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      min_value INTEGER DEFAULT 0,
      max_value INTEGER DEFAULT 10,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      session_date TEXT NOT NULL,
      session_time TEXT,
      time_point TEXT,
      therapist_notes TEXT,
      reaction_snippets TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      version INTEGER DEFAULT 1,
      is_deleted INTEGER DEFAULT 0,
      is_withdrawn INTEGER DEFAULT 0,
      withdrawal_reason TEXT,
      submission_type TEXT DEFAULT 'normal',
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS log_emotions (
      id TEXT PRIMARY KEY,
      log_id TEXT NOT NULL,
      scale_id TEXT NOT NULL,
      value INTEGER,
      FOREIGN KEY (log_id) REFERENCES logs(id),
      FOREIGN KEY (scale_id) REFERENCES emotion_scales(id)
    );

    CREATE TABLE IF NOT EXISTS log_tracks (
      id TEXT PRIMARY KEY,
      log_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      order_index INTEGER,
      notes TEXT,
      FOREIGN KEY (log_id) REFERENCES logs(id),
      FOREIGN KEY (track_id) REFERENCES tracks(id)
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY,
      log_id TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved INTEGER DEFAULT 0
    );
  `);

  const scaleCount = db.prepare('SELECT COUNT(*) as count FROM emotion_scales').get();
  if (scaleCount.count === 0) {
    const scales = [
      { id: 'scale_1', name: '情绪愉悦度', description: '从悲伤到愉悦' },
      { id: 'scale_2', name: '焦虑程度', description: '从平静到焦虑' },
      { id: 'scale_3', name: '参与度', description: '从被动到主动参与' },
      { id: 'scale_4', name: '放松程度', description: '从紧张到放松' }
    ];
    
    const insertScale = db.prepare('INSERT INTO emotion_scales (id, name, description) VALUES (?, ?, ?)');
    scales.forEach(s => insertScale.run(s.id, s.name, s.description));
  }

  return db;
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = { initDB, generateId };
