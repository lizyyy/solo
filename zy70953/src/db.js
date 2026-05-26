'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id            TEXT PRIMARY KEY,
      batch_key     TEXT NOT NULL UNIQUE,
      submitted_by  TEXT,
      submitted_at  TEXT NOT NULL,
      summary       TEXT NOT NULL,
      raw_manifest  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS details (
      id              TEXT PRIMARY KEY,
      batch_id        TEXT NOT NULL,
      kind            TEXT NOT NULL,
      item_key        TEXT NOT NULL,
      status          TEXT NOT NULL,
      rule_code       TEXT,
      message         TEXT,
      suggestion      TEXT,
      raw_fields      TEXT NOT NULL,
      linked_report_id TEXT,
      created_at      TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_details_batch  ON details(batch_id);
    CREATE INDEX IF NOT EXISTS idx_details_status ON details(status);
    CREATE INDEX IF NOT EXISTS idx_details_item   ON details(item_key);

    CREATE TABLE IF NOT EXISTS reports (
      id            TEXT PRIMARY KEY,
      batch_id      TEXT NOT NULL,
      generated_at  TEXT NOT NULL,
      total         INTEGER NOT NULL,
      normal        INTEGER NOT NULL,
      pending       INTEGER NOT NULL,
      failed        INTEGER NOT NULL,
      summary_json  TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id            TEXT PRIMARY KEY,
      batch_id      TEXT,
      detail_id     TEXT,
      event         TEXT NOT NULL,
      at            TEXT NOT NULL,
      meta          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_detail ON audit_log(detail_id);
    CREATE INDEX IF NOT EXISTS idx_audit_batch  ON audit_log(batch_id);
  `);
};

init();

module.exports = db;
