const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/migration.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS old_endpoints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        method TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS new_endpoints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        method TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        old_endpoint_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (old_endpoint_id) REFERENCES old_endpoints(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS calling_systems (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT,
        contact_info TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS compatibility_layers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        old_endpoint_id TEXT,
        new_endpoint_id TEXT,
        transformation_rules TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (old_endpoint_id) REFERENCES old_endpoints(id),
        FOREIGN KEY (new_endpoint_id) REFERENCES new_endpoints(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS traffic_batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        calling_system_id TEXT,
        new_endpoint_id TEXT,
        traffic_percentage INTEGER DEFAULT 0,
        status TEXT DEFAULT 'planned',
        planned_at DATETIME,
        executed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (calling_system_id) REFERENCES calling_systems(id),
        FOREIGN KEY (new_endpoint_id) REFERENCES new_endpoints(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        old_endpoint_id TEXT,
        new_endpoint_id TEXT,
        calling_system_id TEXT,
        request_input TEXT,
        response_output TEXT,
        status TEXT,
        error_message TEXT,
        responsible_node TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES traffic_batches(id),
        FOREIGN KEY (old_endpoint_id) REFERENCES old_endpoints(id),
        FOREIGN KEY (new_endpoint_id) REFERENCES new_endpoints(id),
        FOREIGN KEY (calling_system_id) REFERENCES calling_systems(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS rollback_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        reason TEXT,
        rolled_back_by TEXT,
        rolled_back_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES traffic_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reconciliation_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        old_response_hash TEXT,
        new_response_hash TEXT,
        is_match BOOLEAN,
        diff_details TEXT,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES traffic_batches(id)
      )`);
    });

    resolve();
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runExecute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  initDatabase,
  runQuery,
  runExecute,
  db
};
