const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dataset_ack.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const initTables = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS dataset_versions (
      id TEXT PRIMARY KEY,
      dataset_name TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      publish_time TEXT,
      publisher TEXT NOT NULL,
      change_summary TEXT,
      change_details TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(dataset_name, version)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS downstream_projects (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL UNIQUE,
      owner TEXT NOT NULL,
      contact_email TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS acknowledgments (
      id TEXT PRIMARY KEY,
      dataset_version_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      assignee TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deadline TEXT,
      acknowledged_at TEXT,
      acknowledgment_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (dataset_version_id) REFERENCES dataset_versions(id),
      FOREIGN KEY (project_id) REFERENCES downstream_projects(id),
      UNIQUE(dataset_version_id, project_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rollback_requests (
      id TEXT PRIMARY KEY,
      dataset_version_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      requester TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver TEXT,
      approval_note TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (dataset_version_id) REFERENCES dataset_versions(id),
      FOREIGN KEY (project_id) REFERENCES downstream_projects(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS acknowledgment_reports (
      id TEXT PRIMARY KEY,
      dataset_version_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      report_data TEXT NOT NULL,
      FOREIGN KEY (dataset_version_id) REFERENCES dataset_versions(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      original_input TEXT,
      processing_basis TEXT,
      result TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run("CREATE INDEX IF NOT EXISTS idx_dataset_versions_status ON dataset_versions(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_acknowledgments_status ON acknowledgments(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_rollback_requests_status ON rollback_requests(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity_type, entity_id)");
};

module.exports = {
  db,
  run,
  get,
  all,
  initTables
};
