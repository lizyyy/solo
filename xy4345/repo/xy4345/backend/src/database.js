const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'podcast.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      episode_number INTEGER,
      title TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT,
      duration INTEGER,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (program_id) REFERENCES programs (id)
    );

    CREATE TABLE IF NOT EXISTS authorizations (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      material_id TEXT,
      type TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      permission_type TEXT NOT NULL,
      valid_from TEXT,
      valid_until TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (program_id) REFERENCES programs (id),
      FOREIGN KEY (material_id) REFERENCES materials (id)
    );

    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      material_id TEXT,
      authorization_id TEXT,
      risk_type TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      detected_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (program_id) REFERENCES programs (id),
      FOREIGN KEY (material_id) REFERENCES materials (id),
      FOREIGN KEY (authorization_id) REFERENCES authorizations (id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      risk_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      comment TEXT NOT NULL,
      status_change TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (risk_id) REFERENCES risks (id)
    );

    CREATE INDEX IF NOT EXISTS idx_materials_program_id ON materials (program_id);
    CREATE INDEX IF NOT EXISTS idx_authorizations_program_id ON authorizations (program_id);
    CREATE INDEX IF NOT EXISTS idx_risks_program_id ON risks (program_id);
    CREATE INDEX IF NOT EXISTS idx_risks_status ON risks (status);
    CREATE INDEX IF NOT EXISTS idx_reviews_risk_id ON reviews (risk_id);
  `);
};

initDatabase();

module.exports = db;
