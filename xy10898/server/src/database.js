const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        variables TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        environment_id TEXT,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        sensitive_fields TEXT,
        status TEXT DEFAULT 'pending',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        request_hash TEXT,
        FOREIGN KEY (environment_id) REFERENCES environments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        status_code INTEGER,
        headers TEXT,
        body TEXT,
        response_time INTEGER,
        is_error BOOLEAN DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sensitive_fields (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        field_path TEXT NOT NULL,
        mask_type TEXT DEFAULT 'partial',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        user_id TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS shared_records (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        share_token TEXT UNIQUE,
        shared_by TEXT,
        permission_level TEXT DEFAULT 'view',
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        reviewer_id TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        previous_status TEXT,
        new_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_requests_env ON requests(environment_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_requests_hash ON requests(request_hash)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_responses_request ON responses(request_id)`);
    });
    resolve();
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
