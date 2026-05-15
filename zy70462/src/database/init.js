const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/validator.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        return reject(err);
      }
    });

    const createTables = async () => {
      try {
        await runQuery(db, `
          CREATE TABLE IF NOT EXISTS batches (
            id TEXT PRIMARY KEY,
            batch_name TEXT NOT NULL,
            operator TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            status TEXT NOT NULL,
            risk_type TEXT,
            notes TEXT
          )
        `);

        await runQuery(db, `
          CREATE TABLE IF NOT EXISTS materials (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            file_summary TEXT NOT NULL,
            material_type TEXT NOT NULL,
            download_url TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (batch_id) REFERENCES batches(id)
          )
        `);

        await runQuery(db, `
          CREATE TABLE IF NOT EXISTS validation_results (
            id TEXT PRIMARY KEY,
            material_id TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            status TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            failure_reason TEXT,
            desensitization_details TEXT,
            validated_at INTEGER NOT NULL,
            validated_by TEXT,
            requires_manual_confirm INTEGER DEFAULT 0,
            manually_confirmed INTEGER DEFAULT 0,
            confirmed_by TEXT,
            confirmed_at INTEGER,
            FOREIGN KEY (material_id) REFERENCES materials(id),
            FOREIGN KEY (batch_id) REFERENCES batches(id)
          )
        `);

        await runQuery(db, `
          CREATE TABLE IF NOT EXISTS candidate_lists (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            candidates TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            executed INTEGER DEFAULT 0,
            executed_at INTEGER,
            FOREIGN KEY (batch_id) REFERENCES batches(id)
          )
        `);

        await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_materials_batch_id ON materials(batch_id)`);
        await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_materials_file_hash ON materials(file_hash)`);
        await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_validation_results_batch_id ON validation_results(batch_id)`);
        await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_validation_results_material_id ON validation_results(material_id)`);
        await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_batches_operator ON batches(operator)`);
        await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_batches_risk_type ON batches(risk_type)`);

        db.close();
        resolve();
      } catch (err) {
        db.close();
        reject(err);
      }
    };

    createTables();
  });
}

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

module.exports = {
  initDatabase,
  getDatabase,
  DB_PATH,
  runQuery
};
