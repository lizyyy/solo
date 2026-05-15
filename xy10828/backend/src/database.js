const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE,
          name TEXT,
          phone TEXT,
          email TEXT,
          company TEXT,
          source TEXT,
          source_id TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS duplicate_candidates (
          id TEXT PRIMARY KEY,
          lead_id TEXT,
          duplicate_lead_id TEXT,
          similarity_score REAL,
          match_reason TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lead_id) REFERENCES leads(id),
          FOREIGN KEY (duplicate_lead_id) REFERENCES leads(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS merge_suggestions (
          id TEXT PRIMARY KEY,
          lead_id TEXT,
          candidate_id TEXT,
          keep_lead_id TEXT,
          merge_lead_id TEXT,
          field_conflicts TEXT,
          resolved_fields TEXT,
          status TEXT DEFAULT 'suggested',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lead_id) REFERENCES leads(id),
          FOREIGN KEY (candidate_id) REFERENCES duplicate_candidates(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS processing_logs (
          id TEXT PRIMARY KEY,
          lead_id TEXT,
          action TEXT,
          status TEXT,
          details TEXT,
          operator TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (lead_id) REFERENCES leads(id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_leads_request_id ON leads(request_id)`);
      
      resolve();
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
  initDatabase,
  runQuery,
  getQuery,
  allQuery,
  db
};
