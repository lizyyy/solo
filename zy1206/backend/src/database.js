const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'simulator.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      consistency_model TEXT NOT NULL,
      seed TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      config TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'follower',
      status TEXT DEFAULT 'active',
      term INTEGER DEFAULT 0,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS partitions (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL,
      is_isolated INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS node_logs (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      log_level TEXT DEFAULT 'INFO',
      message TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id),
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      candidate_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      granted INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id),
      FOREIGN KEY (candidate_id) REFERENCES nodes(id),
      FOREIGN KEY (voter_id) REFERENCES nodes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      term INTEGER NOT NULL,
      proposer_id TEXT NOT NULL,
      proposal_number INTEGER NOT NULL,
      value TEXT,
      status TEXT DEFAULT 'pending',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id),
      FOREIGN KEY (proposer_id) REFERENCES nodes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lock_records (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      lock_key TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      acquired_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      released_at TEXT,
      timeout INTEGER DEFAULT 10000,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id),
      FOREIGN KEY (holder_id) REFERENCES nodes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stale_reads (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      key TEXT NOT NULL,
      read_value TEXT,
      latest_value TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id),
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      node_id TEXT,
      details TEXT,
      order_index INTEGER,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id),
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    )
  `);
});

module.exports = db;
