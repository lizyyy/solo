const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/claims.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        batch_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        total_claims INTEGER DEFAULT 0,
        processed_claims INTEGER DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        baggage_tag_no TEXT NOT NULL,
        passenger_name TEXT,
        passenger_phone TEXT,
        flight_no TEXT,
        flight_date DATE,
        route TEXT,
        claim_type TEXT,
        claim_amount DECIMAL(10,2),
        compensation_level TEXT,
        responsible_segment TEXT,
        is_overdue BOOLEAN DEFAULT 0,
        needs_manual_review BOOLEAN DEFAULT 0,
        review_reason TEXT,
        status TEXT DEFAULT 'pending',
        status_reason TEXT,
        handler TEXT,
        handled_at DATETIME,
        photos TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS processing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        handler TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claim_id) REFERENCES claims(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS flight_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT NOT NULL,
        flight_no TEXT,
        departure TEXT,
        arrival TEXT,
        departure_time DATETIME,
        arrival_time DATETIME,
        segment_order INTEGER,
        is_responsible BOOLEAN DEFAULT 0,
        FOREIGN KEY (claim_id) REFERENCES claims(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS photo_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT NOT NULL,
        photo_path TEXT NOT NULL,
        photo_type TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claim_id) REFERENCES claims(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_baggage_tag ON claims(baggage_tag_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_segment ON claims(responsible_segment)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_level ON claims(compensation_level)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_batch ON claims(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_claim ON processing_logs(claim_id)`);
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
