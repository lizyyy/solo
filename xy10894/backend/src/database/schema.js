const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/policy.db');
const db = new sqlite3.Database(dbPath);

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS policy_versions (
        id TEXT PRIMARY KEY,
        policy_code TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        applicable_departments TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(policy_code, version_number)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS approval_nodes (
        id TEXT PRIMARY KEY,
        policy_version_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        node_name TEXT NOT NULL,
        approver_role TEXT NOT NULL,
        approver_user TEXT,
        status TEXT DEFAULT 'PENDING',
        comment TEXT,
        approved_at DATETIME,
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id),
        UNIQUE(policy_version_id, node_order)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS publish_channels (
        id TEXT PRIMARY KEY,
        policy_version_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        publish_time DATETIME,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id),
        UNIQUE(policy_version_id, channel_name)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reading_confirmations (
        id TEXT PRIMARY KEY,
        policy_version_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        confirmed_at DATETIME,
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id),
        UNIQUE(policy_version_id, user_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS abolish_records (
        id TEXT PRIMARY KEY,
        policy_version_id TEXT NOT NULL,
        abolish_reason TEXT,
        abolished_by TEXT,
        abolished_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS policy_references (
        id TEXT PRIMARY KEY,
        policy_version_id TEXT NOT NULL,
        referenced_policy_code TEXT NOT NULL,
        referenced_version_number INTEGER,
        reference_type TEXT NOT NULL,
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id),
        UNIQUE(policy_version_id, referenced_policy_code, reference_type)
      )`);

      resolve();
    });
  });
};

module.exports = { db, initTables };
