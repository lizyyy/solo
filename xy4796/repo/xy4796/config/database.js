const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './benchmark.db';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS benchmark_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT UNIQUE NOT NULL,
          version TEXT,
          package TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          pprof_summary TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS benchmark_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          ns_op REAL,
          b_op REAL,
          allocs_op REAL,
          mb_s REAL,
          extra TEXT,
          FOREIGN KEY (run_id) REFERENCES benchmark_runs (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS comparisons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          base_run_id INTEGER NOT NULL,
          new_run_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          overall_status TEXT,
          FOREIGN KEY (base_run_id) REFERENCES benchmark_runs (id),
          FOREIGN KEY (new_run_id) REFERENCES benchmark_runs (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS comparison_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comparison_id INTEGER NOT NULL,
          benchmark_name TEXT NOT NULL,
          metric TEXT NOT NULL,
          base_value REAL,
          new_value REAL,
          delta_percent REAL,
          status TEXT,
          threshold_exceeded INTEGER DEFAULT 0,
          FOREIGN KEY (comparison_id) REFERENCES comparisons (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          tag TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          notes TEXT,
          FOREIGN KEY (run_id) REFERENCES benchmark_runs (id)
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_benchmark_runs_run_id ON benchmark_runs (run_id)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_benchmark_results_run_id ON benchmark_results (run_id)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_comparison_details_comparison_id ON comparison_details (comparison_id)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_audit_tags_run_id ON audit_tags (run_id)
      `);

      resolve();
    });
  });
};

module.exports = {
  db,
  initDatabase
};
