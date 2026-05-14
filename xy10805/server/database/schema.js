const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/idempotency-audit.db');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
    });

    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT UNIQUE NOT NULL,
        service_name TEXT NOT NULL,
        api_endpoint TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        request_method TEXT NOT NULL,
        request_body TEXT,
        first_request_at DATETIME NOT NULL,
        first_response_status INTEGER,
        first_response_body TEXT,
        last_request_at DATETIME,
        request_count INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        expires_at DATETIME,
        conflict_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key_id INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        request_method TEXT NOT NULL,
        request_body TEXT,
        response_status INTEGER,
        response_body TEXT,
        is_reused BOOLEAN DEFAULT 0,
        is_conflict BOOLEAN DEFAULT 0,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idempotency_key_id) REFERENCES idempotency_keys(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_trails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key_id INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        details TEXT,
        actor TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (idempotency_key_id) REFERENCES idempotency_keys(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(idempotency_key)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_service_name ON idempotency_keys(service_name)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_status ON idempotency_keys(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_request_logs_key ON request_logs(idempotency_key)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_trails_key ON audit_trails(idempotency_key)`);
    });

    db.close((err) => {
      if (err) reject(err);
      resolve();
    });
  });
};

const getConnection = () => {
  return new sqlite3.Database(dbPath);
};

module.exports = { initDatabase, getConnection, dbPath };
