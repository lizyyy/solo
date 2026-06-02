const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/score-validator.db');
let db;

function initDB() {
  const fs = require('fs');
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processing'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      filename TEXT NOT NULL,
      original_name TEXT,
      file_path TEXT,
      file_type TEXT,
      size INTEGER,
      upload_status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER,
      batch_id INTEGER,
      track_name TEXT,
      track_number INTEGER,
      instrument TEXT,
      page_count INTEGER,
      start_page INTEGER,
      end_page INTEGER,
      expected_pages TEXT,
      validation_status TEXT DEFAULT 'pending',
      is_valid BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER,
      file_id INTEGER,
      batch_id INTEGER,
      anomaly_type TEXT,
      description TEXT,
      severity TEXT,
      suggestion TEXT,
      evidence TEXT,
      resolved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER,
      file_id INTEGER,
      batch_id INTEGER,
      content TEXT,
      author TEXT DEFAULT '小温',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER,
      file_id INTEGER,
      batch_id INTEGER,
      source_a TEXT,
      value_a TEXT,
      source_b TEXT,
      value_b TEXT,
      field_name TEXT,
      suggestion TEXT,
      resolved BOOLEAN DEFAULT 0,
      resolution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);
  });

  return db;
}

function getDB() {
  if (!db) {
    return initDB();
  }
  return db;
}

module.exports = { initDB, getDB };
