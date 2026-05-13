const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'anti-leech.db');
let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS download_tokens (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      max_uses INTEGER DEFAULT 1,
      current_uses INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      FOREIGN KEY (file_id) REFERENCES files(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      device_info TEXT,
      access_time INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      request_id TEXT UNIQUE,
      FOREIGN KEY (token_id) REFERENCES download_tokens(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS anomaly_events (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      detected_at INTEGER NOT NULL,
      resolved_at INTEGER,
      suggested_action TEXT,
      action_taken TEXT,
      FOREIGN KEY (token_id) REFERENCES download_tokens(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_token ON download_tokens(token)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_status ON download_tokens(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_token ON access_logs(token_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_ip ON access_logs(ip_address)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomaly_events(anomaly_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_anomalies_token ON anomaly_events(token_id)`);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  return db;
}

module.exports = {
  initDatabase,
  saveDatabase,
  getDb
};
