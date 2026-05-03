const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../../config');

let db = null;

function getDbPath() {
  const dbPath = config.database.path;
  const dir = path.dirname(dbPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return dbPath;
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = getDbPath();
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS participants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'registered',
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            participant_id TEXT NOT NULL,
            credential_data TEXT NOT NULL,
            signature TEXT NOT NULL,
            qr_code TEXT,
            status TEXT DEFAULT 'active',
            valid_from TIMESTAMP,
            valid_until TIMESTAMP,
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_verified_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participant_id) REFERENCES participants (id)
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS revocation_list (
            id TEXT PRIMARY KEY,
            credential_id TEXT NOT NULL,
            reason TEXT,
            revoked_by TEXT,
            revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (credential_id) REFERENCES credentials (id)
          )
        `);
        
        db.run(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            credential_id TEXT,
            participant_id TEXT,
            status_before TEXT,
            status_after TEXT,
            operator TEXT,
            ip_address TEXT,
            user_agent TEXT,
            result TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_credentials_participant ON credentials (participant_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials (status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)`);
        
        resolve();
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  initDatabase,
  getDb,
  run,
  get,
  all
};
