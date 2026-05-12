const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db;
let SQL;

async function init() {
  SQL = await initSqlJs();
  db = new SQL.Database();

  createTables();
  createIndexes();
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      member_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      level TEXT DEFAULT '普通',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS point_batches (
      batch_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      total_points INTEGER NOT NULL,
      available_points INTEGER NOT NULL,
      frozen_points INTEGER DEFAULT 0,
      consumed_points INTEGER DEFAULT 0,
      expired_points INTEGER DEFAULT 0,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      effective_date DATE NOT NULL,
      expire_date DATE NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ledger_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_id TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      transaction_ref TEXT NOT NULL,
      batch_id TEXT,
      points INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      frozen_before INTEGER DEFAULT 0,
      frozen_after INTEGER DEFAULT 0,
      description TEXT,
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS freeze_records (
      freeze_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      freeze_ref TEXT NOT NULL,
      points INTEGER NOT NULL,
      status TEXT DEFAULT 'frozen',
      reason TEXT,
      expire_at DATETIME,
      unfreeze_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS freeze_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      freeze_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consume_records (
      consume_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      order_no TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL,
      status TEXT DEFAULT 'success',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consume_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consume_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      refunded_points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refund_records (
      refund_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      consume_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      status TEXT DEFAULT 'success',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refund_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expire_records (
      expire_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      expire_date DATE NOT NULL,
      task_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS expire_tasks (
      task_id TEXT PRIMARY KEY,
      execute_date DATE NOT NULL,
      status TEXT DEFAULT 'pending',
      total_members INTEGER DEFAULT 0,
      total_points INTEGER DEFAULT 0,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS adjustment_records (
      adjust_id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      batch_id TEXT,
      adjust_type TEXT NOT NULL,
      points_before INTEGER NOT NULL,
      points_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      diff_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotent_keys (
      idempotent_key TEXT PRIMARY KEY,
      service TEXT NOT NULL,
      data_hash TEXT,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function createIndexes() {
}

function getDb() {
  return {
    prepare: (sql) => {
      return {
        get: function(...params) {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const obj = stmt.getAsObject();
            stmt.free();
            return obj;
          }
          stmt.free();
          return undefined;
        },
        all: function(...params) {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
        run: function(...params) {
          db.run(sql, params);
          return { changes: db.getRowsModified() };
        }
      };
    },
    exec: (sql) => db.exec(sql),
    transaction: (fn) => {
      return function(...args) {
        db.run('BEGIN TRANSACTION');
        try {
          const result = fn.apply(this, args);
          db.run('COMMIT');
          return result;
        } catch (e) {
          db.run('ROLLBACK');
          throw e;
        }
      };
    }
  };
}

module.exports = { init, getDb };
